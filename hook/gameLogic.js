const { DIRECT, ENEMY_LOCATION, KEYBOARD, TAGS, STATE, POS } = require("./globalParams");
const { UP, DOWN, LEFT, RIGHT } = DIRECT
const { WALL } = TAGS
const { GAME_STATE_MENU, GAME_STATE_INIT, GAME_STATE_START, GAME_STATE_WIN, GAME_STATE_OVER } = STATE

//类引入
const { Menu } = require("../gameClass/menu");
const { Stage } = require("../gameClass/stage");
const { Map } = require("../gameClass/map");
const { PlayTank, EnemyOne, EnemyTwo, EnemyThree } = require("../gameClass/tank");

//服务器通信消息引入
const {
    ServerSendMsg,
    DrawMsg, SyncMsg,
    MSG_TYPE_SERVER,
    OPERA_DRAW_TYPE, SYNC_SERVER_TYPE, OPERA_CLEAR_TYPE
} = require("../socket/socketMessage")
//


//游戏循环控制
const gameLoop = function (ws) {
    let gameInstance = ws.gameInstance;
    switch (gameInstance.gameState) {
        case GAME_STATE_MENU:
            {
                //实质为通知客户端修改游戏状态
                gameInstance.menu.draw(ws);
                break;
            }
        case GAME_STATE_INIT:
            {
                // gameInstance.stage.draw(ws, gameInstance);
                //初始化本地的map
                initMap(gameInstance, gameInstance.level);
                break;
            }
        case GAME_STATE_START:
            {
                //对应client的drawAll，这里拆开来写
                drawAll(ws, gameInstance)
                if (
                    gameInstance.isGameOver ||
                    (gameInstance.player1.lives <= 0 && gameInstance.player2.lives <= 0)
                ) {
                    gameInstance.gameState = GAME_STATE_OVER;
                    //同步客户端游戏状态，实质上同步isGameOver标识
                    ServerSendMsg(
                        ws,
                        MSG_TYPE_SERVER.MSG_SYNC_SERVER,
                        new SyncMsg('game_isover', SYNC_SERVER_TYPE.BASIC_DATA_SERVER, { level: 1, target: ["isGameOver"], value: true })
                    );
                    //把游戏结束标识设置为true之后客户端自动执行游戏结束界面绘制和结束音效播放并更改游戏状态为OVER
                    // gameInstance.map.homeHit(ws);
                }
                if (
                    gameInstance.appearEnemy == gameInstance.maxEnemy &&
                    gameInstance.enemyArray.length == 0
                ) {
                    gameInstance.gameState = GAME_STATE_WIN;
                    ServerSendMsg(
                        ws,
                        MSG_TYPE_SERVER.MSG_SYNC_SERVER,
                        new SyncMsg('game_state', SYNC_SERVER_TYPE.BASIC_DATA_SERVER, { level: 1, target: ["gameState"], value: STATE.GAME_STATE_WIN })
                    );
                }
                break;
            }
        case GAME_STATE_WIN:
            //客户端检测到游戏状态为win自动跳到下一关
            nextLevel(gameInstance);
            break;
        case GAME_STATE_OVER:
            //gameOver(gameInstance);
            break;
    }
};
//初始化对象
const initObject = function (gameInstance) {
    gameInstance.menu = new Menu(gameInstance);
    gameInstance.stage = new Stage(gameInstance);
    gameInstance.map = new Map(gameInstance);

    gameInstance.player1 = new PlayTank(gameInstance);
    //玩家1出生点
    gameInstance.player1.x = 129 + gameInstance.map.offsetX;
    gameInstance.player1.y = 385 + gameInstance.map.offsetY;
    gameInstance.player2 = new PlayTank(gameInstance);
    gameInstance.player2.offsetX = 128; //player2的图片x与图片1相距128
    gameInstance.player2.x = 256 + gameInstance.map.offsetX;
    gameInstance.player2.y = 385 + gameInstance.map.offsetY;

    gameInstance.appearEnemy = 0; //已出现的敌方坦克
    gameInstance.enemyArray = []; //敌方坦克
    gameInstance.bulletArray = []; //子弹数组
    gameInstance.keys = []; //记录按下的按键
    gameInstance.crackArray = []; //爆炸数组
    gameInstance.isGameOver = false;
    gameInstance.overX = 176;
    gameInstance.overY = 384;
    //gameInstance.overCtx.clearRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);
    gameInstance.emenyStopTime = 0;
    gameInstance.homeProtectedTime = -1;
    gameInstance.propTime = 1000;
};


//初始化地图
const initMap = function (gameInstance, level) {
    gameInstance.map.setMapLevel(level);
    //gameInstance.map.draw(maxEnemy);
    //drawLives(gameInstance, { p1Lives, p2Lives });
};
//绘制所有
const drawAll = function (ws, gameInstance) {
    addAndDrawEnemyTanks(ws, gameInstance);
    drawBullets(ws, gameInstance);
    // drawCracks(ws, gameInstance);
    keyEventForPlayerMove(ws, gameInstance);
    // //道具绘制
    // if (gameInstance.propTime <= 0) {
    //     drawProp(ws, gameInstance);
    // } else {
    //     gameInstance.propTime--;
    // }
    // if (gameInstance.homeProtectedTime > 0) {
    //     gameInstance.homeProtectedTime--;
    // } else if (gameInstance.homeProtectedTime == 0) {
    //     gameInstance.homeProtectedTime = -1;
    //     homeNoProtected();
    // }
};
//添加和绘制地方坦克
const addAndDrawEnemyTanks = function (ws, gameInstance) {
    // //敌方坦克添加
    if (gameInstance.appearEnemy < gameInstance.maxEnemy) {
        //主循环20ms一次，递增mainframe到100，即2000ms，2s添加一次敌方坦克
        if (gameInstance.mainframe % 100 == 0) {
            addEnemyTank(ws, gameInstance);
            gameInstance.mainframe = 0;
        }
        gameInstance.mainframe++;
    }
    //实际绘制敌方坦克
    drawEnemyTanks(ws, gameInstance);
};
//添加坦克，并不是实际绘制，只是对坦克数组进行添加
const addEnemyTank = function (ws, gameInstance) {
    //边界条件判断
    if (gameInstance.enemyArray == null || gameInstance.enemyArray.length >= gameInstance.maxAppearEnemy || gameInstance.maxEnemy == 0) {
        return;
    }
    gameInstance.appearEnemy++;
    //随机生成三种类型坦克
    var rand = parseInt(Math.random() * 3);
    var obj = null;
    if (rand == 0) {
        obj = new EnemyOne();
    } else if (rand == 1) {
        obj = new EnemyTwo();
    } else if (rand == 2) {
        obj = new EnemyThree();
    }
    //tankType
    obj.aiTankType = rand;
    //随机重生点
    obj.x = ENEMY_LOCATION[parseInt(Math.random() * 3)] + gameInstance.map.offsetX;
    obj.y = gameInstance.map.offsetY;
    obj.dir = DOWN;
    //添加坦克对象到坦克数组中
    gameInstance.enemyArray[gameInstance.enemyArray.length] = obj;
    //同步坦克对象到客户端
    ServerSendMsg(
        ws,
        MSG_TYPE_SERVER.MSG_SYNC_SERVER,
        new SyncMsg('enemy_add', SYNC_SERVER_TYPE.ENEMYTANK_ADD, { tankType: obj.aiTankType, x: obj.x })
    );
    //更新地图右侧坦克数
    // gameInstance.map.clearEnemyNum(gameInstance.maxEnemy, gameInstance.appearEnemy);
    let { maxEnemy, appearEnemy } = gameInstance;
    ServerSendMsg(
        ws,
        MSG_TYPE_SERVER.MSG_OPERA_DRAW,
        new DrawMsg('enemynum_clear', OPERA_DRAW_TYPE.ENEMYNUM_CLEAR, { maxEnemy, appearEnemy })
    );
};
//绘制玩家坦克
const drawPlayerTank = function (ws, gameInstance) {
    // gameInstance.tankCtx.clearRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);
    clearRectByCtxName(ws, OPERA_CLEAR_TYPE.TANKCTX_CLEAR)
    //玩家坦克1绘制
    if (gameInstance.player1.lives > 0) {
        //gameInstance.player1.draw();
        //坦克出生保护机制
        if (gameInstance.player1.isProtected) {
            gameInstance.player1.protectedTime--;
            if (gameInstance.player1.protectedTime == 0) {
                //console.log(false);
                gameInstance.player1.isProtected = false;
            }
        }
        let { dir, x, y, isProtected, protectedTime } = gameInstance.player1;
        let refers = { dir, x, y, isProtected, protectedTime }
        ServerSendMsg(
            ws,
            MSG_TYPE_SERVER.MSG_OPERA_DRAW,
            new DrawMsg('player1_draw', OPERA_DRAW_TYPE.PLAYER1_DRAW, refers)
        );

    }
    //玩家坦克2绘制
    if (gameInstance.player2.lives > 0) {
        // gameInstance.player2.draw();
        //坦克出生保护机制
        if (gameInstance.player2.isProtected) {
            gameInstance.player2.protectedTime--;
            if (gameInstance.player2.protectedTime == 0) {
                gameInstance.player2.isProtected = false;
            }
        }
        let { dir, x, y, isProtected, protectedTime } = gameInstance.player2;
        let refers = { dir, x, y, isProtected, protectedTime }
        ServerSendMsg(
            ws,
            MSG_TYPE_SERVER.MSG_OPERA_DRAW,
            new DrawMsg('player2_draw', OPERA_DRAW_TYPE.PLAYER2_DRAW, refers)
        );
    }
    drawLives(ws, gameInstance);//绘制坦克生命数

};
//绘制坦克生命数
const drawLives = function (ws, gameInstance) {
    // gameInstance.map.drawLives(gameInstance.player1.lives, 1);
    // gameInstance.map.drawLives(gameInstance.player2.lives, 2);
    let p1Lives = gameInstance.player1.lives;
    let p2Lives = gameInstance.player2.lives;
    ServerSendMsg(
        ws,
        MSG_TYPE_SERVER.MSG_OPERA_DRAW,
        new DrawMsg('lives_draw', OPERA_DRAW_TYPE.LIVES_DRAW, { p1Lives, p2Lives })
    );
};
//绘制子弹
const drawBullets = function (ws, gameInstance) {
    if (gameInstance.bulletArray != null && gameInstance.bulletArray.length > 0) {
        for (let i = 0; i < gameInstance.bulletArray.length; i++) {
            var bulletObj = gameInstance.bulletArray[i];
            if (bulletObj.isDestroyed) {
                //子弹宿主对象，
                bulletObj.owner.isShooting = false;
                gameInstance.bulletArray.removeByIndex(i);
                //同步数据到客户端
                //清除已被摧毁的子弹
                ServerSendMsg(
                    ws,
                    MSG_TYPE_SERVER.MSG_SYNC_SERVER,
                    new SyncMsg('bullet_remove', SYNC_SERVER_TYPE.BULLET_REMOVE, { removeArr: [i] })
                );
                i--;
            } else {
                bulletObj.draw(ws, gameInstance, i);
            }
        }
        //子弹移动以及碰撞检测
        for (let index = 0; index < gameInstance.bulletArray.length; index++) {
            const element = gameInstance.bulletArray[index];
            bulletsMoveAndTest(gameInstance, ws, element, index);
        }
    }
};
//控制客户端绘制敌方坦克s//调用了坦克类的draw方法
const drawEnemyTanks = function (ws, gameInstance) {
    //边界条件判断
    //let removeArr = [];
    if (gameInstance.enemyArray != null || gameInstance.enemyArray.length > 0) {
        for (let i = 0; i < gameInstance.enemyArray.length; i++) {
            var enemyObj = gameInstance.enemyArray[i];
            if (enemyObj.isDestroyed) {
                gameInstance.enemyArray.removeByIndex(i);
                ServerSendMsg(
                    ws,
                    MSG_TYPE_SERVER.MSG_SYNC_SERVER,
                    new SyncMsg('enemy_remove', SYNC_SERVER_TYPE.ENEMYTANK_REMOVE, { removeArr: [i] })
                );
                // removeArr.push(i);
                i--;
            } else {
                //params(ws, gameInstance, tankIndex)
                enemyObj.draw(ws, gameInstance, i);
                //发送绘制敌方坦克消息到服务器，根据坦克index绘制
            }
        }
    }
    if (gameInstance.emenyStopTime > 0) {
        gameInstance.emenyStopTime--;
    }
};
//子弹移动及碰撞检测
const bulletsMoveAndTest = function (gameInstance, ws, bulletObj, bulletIndex) {
    if (bulletObj.dir == UP) {
        bulletObj.y -= bulletObj.speed;
    } else if (bulletObj.dir == DOWN) {
        bulletObj.y += bulletObj.speed;
    } else if (bulletObj.dir == RIGHT) {
        bulletObj.x += bulletObj.speed;
    } else if (bulletObj.dir == LEFT) {
        bulletObj.x -= bulletObj.speed;
    }

    bulletObj.isHit(gameInstance, ws, bulletIndex);
};
//针对玩家移动的键盘事件
const keyEventForPlayerMove = function (ws, gameInstance) {
    // console.log(gameInstance.keys);
    //player1移动
    if (gameInstance.keys.contain(KEYBOARD.W)) {
        // console.log("player1 move up");
        playerMove(ws, gameInstance, 1, UP, false)
    } else if (gameInstance.keys.contain(KEYBOARD.S)) {
        playerMove(ws, gameInstance, 1, DOWN, false)
    } else if (gameInstance.keys.contain(KEYBOARD.A)) {
        playerMove(ws, gameInstance, 1, LEFT, false)
    } else if (gameInstance.keys.contain(KEYBOARD.D)) {
        playerMove(ws, gameInstance, 1, RIGHT, false)
    }
    //player2移动
    if (gameInstance.keys.contain(KEYBOARD.UP)) {
        // console.log("player2 move up");
        playerMove(ws, gameInstance, 2, UP, false)
    } else if (gameInstance.keys.contain(KEYBOARD.DOWN)) {
        playerMove(ws, gameInstance, 2, DOWN, false)
    } else if (gameInstance.keys.contain(KEYBOARD.LEFT)) {
        playerMove(ws, gameInstance, 2, LEFT, false)
    } else if (gameInstance.keys.contain(KEYBOARD.RIGHT)) {
        playerMove(ws, gameInstance, 2, RIGHT, false)
    }
}
//玩家移动，辅助函数
const playerMove = function (ws, gameInstance, index, temp_dir, hit) {
    gameInstance["player" + index]["dir"] = temp_dir;
    gameInstance["player" + index]["hit"] = hit;
    gameInstance["player" + index].move(gameInstance);
    //将移动后坦克位置数据同步客户端
    const { dir, x, y } = gameInstance["player" + index];
    ServerSendMsg(
        ws,
        MSG_TYPE_SERVER.MSG_SYNC_SERVER,
        new SyncMsg(
            'player_move',
            SYNC_SERVER_TYPE.PLAYER_MOVE,
            { index, dir, x, y }
        )
    );
}
//绘制爆炸
const drawCracks = function (ws, gameInstance) {
    if (gameInstance.crackArray != null && gameInstance.crackArray.length > 0) {
        for (let i = 0; i < gameInstance.crackArray.length; i++) {
            let crackObj = gameInstance.crackArray[i];
            if (crackObj.isOver) {
                gameInstance.crackArray.removeByIndex(i);
                //同步数据到客户端
                //清除已结束的crack
                ServerSendMsg(
                    ws,
                    MSG_TYPE_SERVER.MSG_SYNC_SERVER,
                    new SyncMsg('crack_remove', SYNC_SERVER_TYPE.CARCK_REMOVE, { removeArr: [i] })
                );
                i--;
                if (crackObj.owner == gameInstance.player1) {
                    gameInstance.player1.renascenc(1, gameInstance);
                } else if (crackObj.owner == gameInstance.player2) {
                    gameInstance.player2.renascenc(2, gameInstance);
                }
            } else {
                //params(ws, crackIndex)
                crackObj.draw(ws, i);
            }
        }
    }
};
//键盘事件
const keyEvent = function (gameInstance) {
    //console.log(gameInstance.player1);
    if (gameInstance.keys.contain(KEYBOARD.W)) {
        gameInstance.player1.dir = UP;
        gameInstance.player1.hit = false;
        gameInstance.player1.move(gameInstance);
    } else if (gameInstance.keys.contain(KEYBOARD.S)) {
        gameInstance.player1.dir = DOWN;
        gameInstance.player1.hit = false;
        gameInstance.player1.move(gameInstance);
    } else if (gameInstance.keys.contain(KEYBOARD.A)) {
        gameInstance.player1.dir = LEFT;
        gameInstance.player1.hit = false;
        gameInstance.player1.move(gameInstance);
    } else if (gameInstance.keys.contain(KEYBOARD.D)) {
        gameInstance.player1.dir = RIGHT;
        gameInstance.player1.hit = false;
        gameInstance.player1.move(gameInstance);
    }

    if (gameInstance.keys.contain(KEYBOARD.UP)) {
        gameInstance.player2.dir = UP;
        gameInstance.player2.hit = false;
        gameInstance.player2.move(gameInstance);
    } else if (gameInstance.keys.contain(KEYBOARD.DOWN)) {
        gameInstance.player2.dir = DOWN;
        gameInstance.player2.hit = false;
        gameInstance.player2.move(gameInstance);
    } else if (gameInstance.keys.contain(KEYBOARD.LEFT)) {
        gameInstance.player2.dir = LEFT;
        gameInstance.player2.hit = false;
        gameInstance.player2.move(gameInstance);
    } else if (gameInstance.keys.contain(KEYBOARD.RIGHT)) {
        gameInstance.player2.dir = RIGHT;
        gameInstance.player2.hit = false;
        gameInstance.player2.move(gameInstance);
    }

};
//绘制道具
const drawProp = function (ws, gameInstance) {
    var rand = Math.random();
    if (rand < 0.4 && gameInstance.prop == null) {
        gameInstance.prop = new Prop(gameInstance);
        //通知客户端产生prop道具
        ServerSendMsg(
            ws,
            MSG_TYPE_SERVER.MSG_SYNC_SERVER,
            new SyncMsg('prop_add', SYNC_SERVER_TYPE.PROP_ADD)
        );
        gameInstance.prop.init(ws);
    }
    if (gameInstance.prop != null) {
        gameInstance.prop.draw(ws, gameInstance);
        if (gameInstance.prop.isDestroyed) {
            gameInstance.prop = null;
            gameInstance.propTime = 1000;
        }
    }
};
//home protected
const homeNoProtected = function () {
    //home周围的墙体
    var mapChangeIndex = [[23, 11], [23, 12], [23, 13], [23, 14], [24, 11], [24, 14], [25, 11], [25, 14]];
    //gameInstance.map.updateMap(mapChangeIndex, WALL);
    let indexArr = mapChangeIndex;
    let target = WALL
    ServerSendMsg(
        ws,
        MSG_TYPE_SERVER.MSG_SYNC_SERVER,
        new SyncMsg('map_update', SYNC_SERVER_TYPE.MAP_UPDATE, { indexArr, target })
    );
};
//下一关
const nextLevel = function (gameInstance) {
    gameInstance.level++;
    if (gameInstance.level == 22) {
        gameInstance.level = 1;
    }
    initObject(gameInstance);
    //只有一个玩家
    if (gameInstance.menu.playNum == 1) {
        gameInstance.player2.lives = 0;
    }
    gameInstance.stage.init(gameInstance.level);
    gameInstance.gameState = GAME_STATE_INIT;

};
//上一关卡
const preLevel = function (gameInstance) {
    gameInstance.level--;
    if (gameInstance.level == 0) {
        gameInstance.level = 1;
    }
    initObject(gameInstance);
    //只有一个玩家
    if (gameInstance.menu.playNum == 1) {
        gameInstance.player2.lives = 0;
    }
    gameInstance.stage.init(gameInstance.level);
    gameInstance.gameState = GAME_STATE_INIT;
};


module.exports = {
    gameLoop,
    initObject,
    preLevel,
    nextLevel,
    initMap,
}



