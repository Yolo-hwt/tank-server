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
const { GAME_MODE, STATE } = require("./globalParams");
const { GAME_STATE_MENU, GAME_STATE_INIT, GAME_STATE_START, GAME_STATE_WIN, GAME_STATE_OVER } = STATE
//eventBus
const { eventBus } = require("./eventBus");
//gameLogic方法引入
const { drawAll, initMap, nextLevel, initObject } = require("./gameLogic");
//instance
const { GameInstance } = require("../gameClass/instance")

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
                    //成功匹配
                    //添加匹配信息到map
                    if (client.matchCodes == matchCodes) {
                        const player1 = name;
                        const player2 = client.name;
                        const val1 = { isReady: false, players: [player1, player2], playerWs: [curPlayerWs, client], curPlayerIndex: 0, partnerIndex: 1 };
                        const val2 = { isReady: false, players: [player1, player2], playerWs: [curPlayerWs, client], curPlayerIndex: 1, partnerIndex: 0 };
                        webSocketTemp.addAdventure(player1, val1);
                        webSocketTemp.addAdventure(player2, val2);
                        //匹配成功处理
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
const matchMultiplayerGameByCodes = function () {

}

module.exports = {
    matchAdventureGameByCodes,
    matchMultiplayerGameByCodes,
    adventureGameLoop,
    initAdventureData
}