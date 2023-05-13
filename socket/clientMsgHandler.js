//socketMessage引入
const {
    ServerSendMsg,
    SyncMsg,
    MSG_TYPE_CLIENT,
    KEY_EVENT_TYPE,
    SYNC_SERVER_TYPE,
    SYNC_CLIENT_TYPE,
    MSG_TYPE_SERVER
} = require("./socketMessage")
const { MSG_BEAT, MSG_KEY, MSG_NORMAL, MSG_SYNC } = MSG_TYPE_CLIENT
const { KEY_EVENT_UP, KEY_EVENT_DOWN } = KEY_EVENT_TYPE
//全局参数引入
const { STATE, KEYBOARD, DIRECT } = require("../hook/globalParams")
const {
    GAME_STATE_MENU,
    GAME_STATE_INIT,
    GAME_STATE_START,
} = STATE;
//引入gameLogic方法
const { preLevel, nextLevel, initObject } = require("../hook/gameLogic")

/**************** HANDLERS *********************** */
//根据客户端发送的msg来运行游戏逻辑
//返回客户端相应的控制指令
const clientMsgHandler = function (cMsg, ws) {
    const type = cMsg.type ?? "default";
    const data = cMsg.data ?? "";
    switch (type) {
        case MSG_NORMAL: {
            normalMsgHandler(data);
            break;
        }
        case MSG_SYNC: {
            syncDataMsgHandler(ws, data);
            break;
        }
        case MSG_BEAT: {
            heartbeatMsgHandler(data)
            break;
        }
        case MSG_KEY: {
            keyEventHandler(ws, data);
            break;
        }
        //
        default: {
            console.log('cMsg 缺少 type');
            break;
        }

    }
}
//普通消息
const normalMsgHandler = function (data) {
    console.log("get client normal msg:", data);
}
//心跳包
const heartbeatMsgHandler = function (data) {
    console.log("get client heart-beat msg:", data);
}
//键盘事件处理
const keyEventHandler = function (ws, data) {
    const keyType = data.keyType ?? "default"
    let gameInstance = ws.gameInstance;
    switch (keyType) {
        case KEY_EVENT_DOWN: {
            keydownMsgHandler(ws, gameInstance, data)
            break;
        }
        case KEY_EVENT_UP: {
            keyupMsgHandler(gameInstance, data)
            break;
        }
        default: {
            console.log('keyType匹配失败');
            break;
        }
    }
}
//客户端同步数据到服务器
const syncDataMsgHandler = function (ws, data) {
    // console.log(ws);
    let gameInstance = ws?.gameInstance;
    const syncType = data.syncType;
    const { refers } = data;
    switch (syncType) {
        case SYNC_CLIENT_TYPE.STAGE_ISREADY: {//客户端stage就绪
            const isReady = refers.isReady ?? false;
            // console.log(gameInstance);
            gameInstance.stage.isReady = isReady;
            gameInstance.gameState = GAME_STATE_START;
            //同步客户端数据
            ServerSendMsg(
                ws,
                MSG_TYPE_SERVER.MSG_SYNC_SERVER,
                new SyncMsg('game_state', SYNC_SERVER_TYPE.BASIC_DATA_SERVER, { level: 1, target: ["gameState"], value: GAME_STATE_START })
            );
            break;
        }
        case SYNC_CLIENT_TYPE.PLAYER_PROTECTED: {//客户端坦克保护状态变更
            const { index, value } = refers;
            gameInstance["player" + index]["isProtected"] = value;
            gameInstance["player" + index]["protectedTime"] = 0;
            break;
        }
        case SYNC_CLIENT_TYPE.OVERANIMATE_ISOK: {//结束游戏动画结束
            gameInstance.level = 1;
            initObject(gameInstance);
            gameInstance.gameState = GAME_STATE_MENU;
            break;
        }
        case SYNC_CLIENT_TYPE.ENEMY_ISAPPEAR: {//敌方坦克appear
            const { index, value } = refers;
            // console.log(index, gameInstance.enemyArray);
            if (gameInstance.enemyArray[index]) {
                gameInstance.enemyArray[index].isAppear = value;
            }
            break
        }
        default:
            break;
    }
}
//键盘回上事件
const keyupMsgHandler = function (gameInstance, data) {
    const code = data.code;
    // console.log('remove:', code);
    gameInstance.keys.remove(code);
}
//键盘按下事件
const keydownMsgHandler = function (ws, gameInstance, data) {
    // ws.send(JSON.stringify({ text: "测试消息" }))
    const code = data.code;
    switch (gameInstance.gameState) {
        case GAME_STATE_MENU: {
            keydown_when_GAME_STATE_MENU(code, gameInstance, ws)
            break;
        }
        case GAME_STATE_START: {
            keydown_when_GAME_STATE_START(code, gameInstance, ws)
            break;
        }
        default: {
            break;
        }
    }
}

/******************** keydown event 辅助函数 **************** */
const keydown_when_GAME_STATE_MENU = function (code, gameInstance, ws) {
    if (code == KEYBOARD.ENTER) {
        gameInstance.gameState = GAME_STATE_INIT;
        //同步客户端数据
        ServerSendMsg(
            ws,
            MSG_TYPE_SERVER.MSG_SYNC_SERVER,
            new SyncMsg(
                'game_state',
                SYNC_SERVER_TYPE.BASIC_DATA_SERVER,
                { level: 1, target: ["gameState"], value: GAME_STATE_INIT }
            )
        );

        //只有一个玩家
        if (gameInstance.menu.playNum == 1) {
            gameInstance.player2.lives = 0;
            ServerSendMsg(
                ws,
                MSG_TYPE_SERVER.MSG_SYNC_SERVER,
                new SyncMsg(
                    'player2_lives',
                    SYNC_SERVER_TYPE.BASIC_DATA_SERVER,
                    { level: 2, target: ["player2", "lives"], value: 0 }
                )
            );
        }

    } else {
        var n = 0;
        if (code == KEYBOARD.DOWN) {
            n = 1;
        } else if (code == KEYBOARD.UP) {
            n = -1;
        }
        gameInstance.menu.next(ws, n);
    }
}
const keydown_when_GAME_STATE_START = function (code, gameInstance, ws) {
    if (!gameInstance.keys.contain(code)) {
        gameInstance.keys.push(code);
    }
    //射击
    if (code == KEYBOARD.SPACE) {
        if (gameInstance.player1.lives > 0) {
            //params(ws, gameInstance, tankIndex, type)
            gameInstance.player1.shoot(ws, gameInstance, 1, 1);
        }
    }
    else if (code == KEYBOARD.ENTER) {
        if (gameInstance.player1.lives > 0) {
            if (gameInstance.player2.lives > 0) {
                gameInstance.player2.shoot(ws, gameInstance, 2, 1);
            }
        }
    } else {
        switch (code) {
            //关卡管理
            case KEYBOARD.N: {//下一关
                nextLevel(ws, gameInstance);
                ServerSendMsg(
                    ws,
                    MSG_TYPE_SERVER.MSG_SYNC_SERVER,
                    new SyncMsg('next_level', SYNC_SERVER_TYPE.SKIP_LEVEL, { level: gameInstance.level })
                );
                break;
            }
            case KEYBOARD.P: {//上一关
                preLevel(ws, gameInstance);
                ServerSendMsg(
                    ws,
                    MSG_TYPE_SERVER.MSG_SYNC_SERVER,
                    new SyncMsg('pre_level', SYNC_SERVER_TYPE.SKIP_LEVEL, { level: gameInstance.level })
                );
                break;
            }
            default:
                break;

        }
    }



}


module.exports = {
    clientMsgHandler,
}