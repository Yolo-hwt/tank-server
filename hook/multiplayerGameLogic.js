//socketMessage
const {
    ServerSendMsg,
    SyncMsg,
    MultiMsg,
    MSG_TYPE_SERVER,
    MULTI_SERVER_TYPE,
    SYNC_SERVER_TYPE
} = require("../socket/socketMessage");
//globalParams
const { GAME_MODE, STATE, MATCH_STATE, MULIPLAYER_LOCATION } = require("./globalParams");
const { GAME_STATE_MENU, GAME_STATE_INIT, GAME_STATE_START, GAME_STATE_WIN, GAME_STATE_OVER } = STATE
//eventBus
const { eventBus } = require("./eventBus");
//gameLogic方法引入
const { drawAll, initMap, nextLevel, initObject } = require("./gameLogic");
//instance
const { GameInstance } = require("../gameClass/instance")
//类引入
const { Menu } = require("../gameClass/menu");
const { Stage } = require("../gameClass/stage");
const { Map } = require("../gameClass/map");
const { PlayTank } = require("../gameClass/tank");

/**
 * @alias 双人游戏匹配方法
 * @author hwt
 * @date 2023 5.14
*/
//双人游戏匹配
const matchAdventureGameByCodes = function (ws, matchTime) {
    const name = ws.name;
    const matchCodes = ws.matchCodes;
    const webSocketTemp = ws.t;
    let clients = {};
    let timeTemp = matchTime * 1000;
    let matchTimer = setInterval(() => {
        //连接已经主动断开
        if (ws.readyState == 2 || ws.readyState == 3) {
            console.log("客户端主动断开");
            clearInterval(matchTimer);
            return;
        }
        if (timeTemp <= 0) {
            //匹配失败
            matchAdventureFailed(webSocketTemp, matchTimer, name)
        }
        timeTemp -= 50;
        //如果adventureMap中存在当前待匹配name说明已经匹配完成
        if (webSocketTemp.getAdventureMap().get(name)) {
            //已经匹配成功
            matchAdventureSuccess(webSocketTemp, matchTimer, name);
        } else {
            //循环查找client，并匹配
            clients = webSocketTemp.getClients();
            let curPlayerWs = clients[name];
            let clientsKey = Object.keys(clients);
            for (let i = 0; i < clientsKey.length; i++) {
                const key = clientsKey[i];
                let client = clients[key];
                if (client && client.name != name) {
                    //成功匹配，matchCodes相同且客户端未匹配到游戏
                    //添加匹配信息到map
                    if (client.matchCodes == matchCodes && !client.isMatchAdventure && !client.isMatchMultiplayer) {
                        const player1 = name;
                        const player2 = client.name;
                        const val1 = { isReady: false, players: [player1, player2], playerWs: [curPlayerWs, client], curPlayerIndex: 0, partnerIndex: 1 };
                        const val2 = { isReady: false, players: [player1, player2], playerWs: [curPlayerWs, client], curPlayerIndex: 1, partnerIndex: 0 };
                        webSocketTemp.addAdventure(player1, val1);
                        webSocketTemp.addAdventure(player2, val2);
                        //匹配成功处理
                        client.isMatchAdventure = true;
                        matchAdventureSuccess(webSocketTemp, matchTimer, name);
                        break;
                    }
                }
            }
        }

    }, 50);
}
//双人游戏匹配成功
const matchAdventureSuccess = function (webSocketTemp, matchTimer, name) {
    clearInterval(matchTimer);
    const ws = webSocketTemp.getClientByName(name);
    let { players, partnerIndex } = webSocketTemp.getAdventureMap().get(name);
    const partner = players[partnerIndex]
    console.log(name + "匹配双人冒险模式，true");
    //同步客户端数据
    ServerSendMsg(
        ws,
        MSG_TYPE_SERVER.MSG_MULTI_SIGN,
        new MultiMsg(
            'adventure_match_ok',
            GAME_MODE.ADVENTURE_GAME,
            MULTI_SERVER_TYPE.ADVENTURE_MATCH_OK,
            { partner }
        )
    );
    //
    //通知server.js开启adventure游戏循环
    eventBus.emit("startAdventure", name);
}
//双人游戏匹配失败
const matchAdventureFailed = function (webSocketTemp, matchTimer, name) {
    console.log(name + "匹配双人冒险模式，false");
    clearInterval(matchTimer);
    let ws = webSocketTemp.getClientByName(name);
    //同步客户端数据
    ServerSendMsg(
        ws,
        MSG_TYPE_SERVER.MSG_MULTI_SIGN,
        new MultiMsg('adventure_match_no', GAME_MODE.ADVENTURE_GAME, MULTI_SERVER_TYPE.ADVENTURE_MATCH_NO)
    );
    //
}
//双人游戏循环控制
const adventureGameLoop = function (wslist, gameInstance) {
    switch (gameInstance.gameState) {
        case GAME_STATE_MENU:
            {
                //实质为通知客户端修改游戏状态
                gameInstance.menu.drawAdventure(wslist, gameInstance);
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
                drawAll(wslist, gameInstance)
                if (
                    gameInstance.isGameOver ||
                    (gameInstance.player1.lives <= 0 && gameInstance.player2.lives <= 0)
                ) {
                    gameInstance.gameState = GAME_STATE_OVER;
                    //同步客户端游戏状态，实质上同步isGameOver标识
                    ServerSendMsg(
                        wslist,
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
                        wslist,
                        MSG_TYPE_SERVER.MSG_SYNC_SERVER,
                        new SyncMsg('game_win', SYNC_SERVER_TYPE.BASIC_DATA_SERVER, { level: 1, target: ["gameState"], value: STATE.GAME_STATE_WIN })
                    );
                }
                break;
            }
        case GAME_STATE_WIN:
            //客户端检测到游戏状态为win自动跳到下一关
            //服务端啊两个ws的stageisReady状态重置
            nextLevel(wslist, gameInstance);
            break;
        case GAME_STATE_OVER:
            //gameOver(gameInstance);
            break;
    }
};
//双人游戏初始化数据
const initAdventureData = function () {
    const gameInstance = new GameInstance();
    initObject(gameInstance);
    gameInstance.map.playNum = 2;
    gameInstance.gameMode = GAME_MODE.ADVENTURE_GAME;
    return gameInstance;
}
/**
 * @alias 四人游戏匹配方法
 * @author hwt
 * @date 2023 5.14
*/
//四人游戏匹配
const matchMultiplayerGameByCodes = function (ws, matchTime) {
    const name = ws.name;
    const matchCodes = ws.matchCodes;
    const webSocketTemp = ws.t;

    let timeTemp = matchTime * 1000 + 3000;
    const matchTimer = setInterval(() => {
        //连接已经主动断开
        if (ws.readyState == 2 || ws.readyState == 3) {
            console.log("客户端" + name + "主动断开");
            clearInterval(matchTimer);
            return;
        }
        if (timeTemp <= 0) {
            //匹配超时，失败
            console.log("匹配超时");
            matchMultiplayerFailed(webSocketTemp, matchTimer, name);
            return;
        }
        timeTemp -= 50;
        //查询是否有匹配队列
        const matchGame = webSocketTemp.getMultiPlayerGameByMatchCode(matchCodes);
        if (matchGame == undefined || matchGame == null) {//没有匹配队列
            //创建匹配队列
            const value = {
                players: { p1: name, p2: null, p3: null, p4: null },
                playerNum: 1,
                match: MATCH_STATE.MULTI_MATCH_ING,
                loopid: 0,
                playerWs: { p1: ws, p2: null, p3: null, p4: null }
            }
            //将ws匹配标识置为true
            ws.isMatchMultiplayer = true;
            //设定其是第几个玩家
            ws.multiplayerIndex = value.playerNum;
            //创建匹配循环
            value.loopid = createMultiplayerMatchLoop(webSocketTemp, matchCodes, matchTime);
            //添加对局
            webSocketTemp.addMultiplayerGame(matchCodes, value);

        } else if (matchGame.match == MATCH_STATE.MULTI_MATCH_FAILED) {
            //匹配失败，解散匹配队列
            console.log("匹配失败，解散匹配队列");
            matchMultiplayerFailed(webSocketTemp, matchTimer, name)

        } else if (matchGame.match == MATCH_STATE.MULTI_MATCH_SUCCESS) {
            //队列显示匹配成功
            //查询是否成功作为对局中的玩家被匹配进入
            const isMatch = webSocketTemp.getMultiPlayerMatchStateByCodeAndName(matchCodes, name);
            if (isMatch) {
                //匹配成功
                //
                matchMultiplayerSuccess(webSocketTemp, matchTimer, name);
            } else {
                //匹配失败
                //房间号被占用
                //匹配失败
                console.log("房间号被占用");
                matchMultiplayerFailed(webSocketTemp, matchTimer, name)
            }
        }
    }, 50);
}
//根据matchCode创建四人匹配游戏循环
const createMultiplayerMatchLoop = function (webSocketTemp, matchCodes, matchTime) {
    let timeTemp = matchTime * 1000;
    let clients = {};
    let matchGame = {};
    const matchTimer = setInterval(() => {
        matchGame = webSocketTemp.getMultiPlayerGameByMatchCode(matchCodes);
        if (!matchGame) {
            return;
        }
        if (timeTemp <= 0) {
            //匹配超时
            //若两人以上匹配则认为匹配成功
            if (matchGame.playerNum >= 2) {
                matchGame.match = MATCH_STATE.MULTI_MATCH_SUCCESS;
            } else {
                matchGame.match = MATCH_STATE.MULTI_MATCH_FAILED;
            }
            clearInterval(matchTimer);
            return;
        }
        if (matchGame.match == MATCH_STATE.MULTI_MATCH_SUCCESS) {
            //匹配成功
            clearInterval(matchTimer);
            return;
        }
        timeTemp -= 50;
        //循环查找client
        clients = webSocketTemp.getClients();
        let clientsKey = Object.keys(clients);
        for (let i = 0; i < clientsKey.length; i++) {
            const client = clients[clientsKey[i]];
            //matchCodes相同，且客户端没有被匹配进入任何对局
            if (client && client.matchCodes == matchCodes && !client.isMatchAdventure && !client.isMatchMultiplayer) {
                //匹配成功处理
                //
                client.isMatchMultiplayer = true;
                //修改multiPlayerGameMap
                matchGame.playerNum++;
                console.log("当前匹配人数", matchGame.playerNum);
                client.multiplayerIndex = matchGame.playerNum;
                matchGame.players["p" + matchGame.playerNum] = client.name;
                matchGame.playerWs["p" + matchGame.playerNum] = client;
                //匹配四人，则匹配成功
                if (matchGame.playerNum >= 4) {
                    matchGame.match = MATCH_STATE.MULTI_MATCH_SUCCESS;
                    break;
                }
            }
        }
    }, 50)
    return matchTimer;
}
//多人游戏匹配成功
const matchMultiplayerSuccess = function (webSocketTemp, matchTimer, name) {
    clearInterval(matchTimer);
    const ws = webSocketTemp.getClientByName(name);
    const matchCodes = ws.matchCodes;
    let { players } = webSocketTemp.getMultiPlayerGameByMatchCode(matchCodes);
    console.log(name + "匹配多人对战模式，true");
    //同步客户端数据
    ServerSendMsg(
        ws,
        MSG_TYPE_SERVER.MSG_MULTI_SIGN,
        new MultiMsg(
            'multiplayer_match_ok',
            GAME_MODE.MULTIPLAER_GAME,
            MULTI_SERVER_TYPE.MULTI_MATCH_OK,
            { players }
        )
    );
    //
    //通知server.js开启adventure游戏循环
    eventBus.emit("startMultiPlayer", name);
}
//多人游戏匹配失败
const matchMultiplayerFailed = function (webSocketTemp, matchTimer, name) {
    clearInterval(matchTimer);
    const ws = webSocketTemp.getClientByName(name);
    console.log(name + "匹配多人对战模式，false");
    //同步客户端数据
    ServerSendMsg(
        ws,
        MSG_TYPE_SERVER.MSG_MULTI_SIGN,
        new MultiMsg('multiplayer_match_no', GAME_MODE.MULTIPLAER_GAME, MULTI_SERVER_TYPE.MULTI_MATCH_NO)
    );
    //
}
//多人游戏循环控制
const multiplayerGameLoop = function (wslist, gameInstance) {
    switch (gameInstance.gameState) {
        case GAME_STATE_MENU:
            {
                //实质为通知客户端修改游戏状态
                //此处可以沿用
                gameInstance.menu.drawAdventure(wslist, gameInstance);
                break;
            }
        case GAME_STATE_INIT:
            {
                // gameInstance.stage.draw(ws, gameInstance);
                //开启true，使用muli时候的setMap方法（四个角没有障碍物）
                initMap(gameInstance, gameInstance.level, true);
                break;
            }
        case GAME_STATE_START:
            {
                //对应client的drawAll，这里拆开来写
                drawAll(wslist, gameInstance, true);
                //玩家存活数量小于1，开始胜负判定和结算
                if (playersLivesNum(gameInstance) <= 1) {
                    //胜负判定
                    for (let i = 0; i < wslist.length; i++) {
                        if (gameInstance["player" + wslist[i].multiplayerIndex].lives > 0) {
                            //客户端游戏状态为win
                            ServerSendMsg(
                                wslist,
                                MSG_TYPE_SERVER.MSG_SYNC_SERVER,
                                new SyncMsg('game_win', SYNC_SERVER_TYPE.BASIC_DATA_SERVER, { level: 1, target: ["gameState"], value: STATE.GAME_STATE_WIN })
                            );
                        } else {
                            //lose
                            ServerSendMsg(
                                wslist,
                                MSG_TYPE_SERVER.MSG_SYNC_SERVER,
                                new SyncMsg('game_lose', SYNC_SERVER_TYPE.BASIC_DATA_SERVER, { level: 1, target: ["gameState"], value: STATE.GAME_STATE_LOSE })
                            );
                        }
                    }
                    gameInstance.gameState = STATE.GAME_STATE_OVER;
                }
                break;
            }
        case GAME_STATE_OVER: {
            //游戏结束
            setTimeout(() => {
                eventBus.emit("clearMultiPlayerData", wslist[0].matchCodes)
            }, 1000);
        }
    }
};
//查询存活玩家数量
const playersLivesNum = function (gameInstance) {
    let num = 0;
    if (gameInstance.player1 && gameInstance.player1.lives > 0) {
        num++;
    }
    if (gameInstance.player2 && gameInstance.player2.lives > 0) {
        num++;
    }
    if (gameInstance.player3 && gameInstance.player3.lives > 0) {
        num++;
    }
    if (gameInstance.player4 && gameInstance.player4.lives > 0) {
        num++;
    }
    return num;
}
//多人游戏游戏初始化数据
const initMultiplayerData = function (playerNum) {
    const gameInstance = new GameInstance();
    multiplayInitObject(gameInstance, playerNum);
    gameInstance.gameMode = GAME_MODE.MULTIPLAER_GAME;
    return gameInstance;
}
//四人联机初始化数据对象
const multiplayInitObject = function (gameInstance, playerNum) {
    gameInstance.menu = new Menu(gameInstance);
    gameInstance.stage = new Stage(gameInstance);
    gameInstance.map = new Map(gameInstance);

    for (let i = 1; i < 5; i++) {
        gameInstance["player" + i] = new PlayTank(gameInstance);
        gameInstance["player" + i].lives = 0;
        //玩家出生点
        gameInstance["player" + i].x = MULIPLAYER_LOCATION["p" + i][0] + gameInstance.map.offsetX;
        gameInstance["player" + i].y = MULIPLAYER_LOCATION["p" + i][1] + gameInstance.map.offsetY;
    }
    // gameInstance.player2.offsetX = 128; //player2的图片x与图片1相距128

    gameInstance.appearEnemy = 0; //已出现的敌方坦克
    gameInstance.enemyArray = []; //敌方坦克
    gameInstance.bulletArray = []; //子弹数组
    gameInstance.keys = []; //记录按下的按键
    gameInstance.crackArray = []; //爆炸数组
    gameInstance.isGameOver = false;
    gameInstance.overX = 176;
    gameInstance.overY = 384;
    // gameInstance.overCtx.clearRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);
    gameInstance.emenyStopTime = 0;
    gameInstance.homeProtectedTime = -1;
    gameInstance.propTime = 1000;
    //玩家数量
    //通知客户端同步玩家数量
    gameInstance.map.playNum = playerNum;
}
module.exports = {
    matchAdventureGameByCodes,
    adventureGameLoop,
    initAdventureData,
    matchMultiplayerGameByCodes,
    multiplayerGameLoop,
    initMultiplayerData,
}