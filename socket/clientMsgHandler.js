//socketMessage引入
const {
    ServerSendMsg,
    SyncMsg,
    MSG_TYPE_CLIENT,
    KEY_EVENT_TYPE,
    SYNC_SERVER_TYPE,
    SYNC_CLIENT_TYPE,
    MSG_TYPE_SERVER,
    MULTI_CLIENT_TYPE
} = require("./socketMessage")
const { MSG_BEAT, MSG_KEY, MSG_NORMAL, MSG_SYNC, MSG_MULTI } = MSG_TYPE_CLIENT
const { KEY_EVENT_UP, KEY_EVENT_DOWN } = KEY_EVENT_TYPE
//全局参数引入
const { STATE, KEYBOARD, GAME_MODE } = require("../hook/globalParams")
const {
    GAME_STATE_MENU,
    GAME_STATE_INIT,
    GAME_STATE_START,
} = STATE;
//引入gameLogic方法
const { preLevel, nextLevel, initObject } = require("../hook/gameLogic");
const { eventBus } = require("../hook/eventBus");

/**************** HANDLERS *********************** */
//根据客户端发送的msg来运行游戏逻辑
//返回客户端相应的控制指令
const clientMsgHandler = function (cMsg, ws, wsServerTemp) {
    // console.log(cMsg);
    const type = cMsg.type ?? "default";
    const data = cMsg.data ?? "";
    const refers = data.refers;
    // console.log(cMsg.data);
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
            keyEventHandler(ws, wsServerTemp, data, refers);
            break;
        }
        case MSG_MULTI: {
            multiMsgHandler(ws, data);
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
const keyEventHandler = function (ws, wsServerTemp, data, refers) {
    //根据玩家用户名获取连接实体
    const name = refers.name;
    const curWs = wsServerTemp.getClientByName(name);
    //从实体上获取游戏模式和对应的playerIndex
    const mode = curWs.gameMode;
    let index = 1;
    if (mode == GAME_MODE.ADVENTURE_GAME) {
        index = curWs.adventureplayerIndex;
    } else if (mode == GAME_MODE.MULTIPLAER_GAME) {
        index = curWs.multiplayerIndex;
    }
    //获取游戏实体
    const gameInstance = curWs.gameInstance;
    //获取键盘事件类型
    const keyType = data.keyType ?? "default"
    switch (keyType) {
        case KEY_EVENT_DOWN: {
            //ws, gameInstance, data, index, mode
            keydownMsgHandler(ws, gameInstance, data, index, mode)
            break;
        }
        case KEY_EVENT_UP: {
            keyupMsgHandler(gameInstance, data, index, mode)
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
    let gameInstance = null;
    if (Array.isArray(ws)) {
        gameInstance = ws[0].gameInstance;
    } else {
        gameInstance = ws.gameInstance;
    }
    // console.log(ws);
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
            if (gameInstance.gameMode == GAME_MODE.ADVENTURE_GAME) {
                break;
            }
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
const keyupMsgHandler = function (gameInstance, data, index) {
    const code = data.code;
    // console.log('remove:', code);
    gameInstance.keys.remove(code + "-" + index);
}
//键盘按下事件
const keydownMsgHandler = function (ws, gameInstance, data, index, mode) {
    // ws.send(JSON.stringify({ text: "测试消息" }))
    const code = data.code;
    switch (gameInstance.gameState) {
        case GAME_STATE_MENU: {
            keydown_when_GAME_STATE_MENU(code, gameInstance, ws)
            break;
        }
        case GAME_STATE_START: {
            keydown_when_GAME_STATE_START(code, gameInstance, ws, index, mode)
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
const keydown_when_GAME_STATE_START = function (code, gameInstance, ws, index, mode) {
    //添加到keys
    if (!gameInstance.keys.contain(code + "-" + index)) {
        gameInstance.keys.push(code + "-" + index);
    }
    //射击
    if (code == KEYBOARD.SPACE) {
        if (gameInstance["player" + index].lives > 0) {
            //params(ws, gameInstance, tankIndex, type)
            gameInstance["player" + index].shoot(ws, gameInstance, index, 1);
        }
    }
    // else if (code == KEYBOARD.ENTER) {
    //     if (gameInstance.player1.lives > 0) {
    //         if (gameInstance.player2.lives > 0) {
    //             gameInstance.player2.shoot(ws, gameInstance, 2, 1);
    //         }
    //     }
    // }
    else {
        if (mode == GAME_MODE.MULTIPLAER_GAME) {//multiPlayer不用上下关卡
            return;
        }
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
//多人游戏事件
const multiMsgHandler = function (ws, data) {
    let gameInstance = null;
    if (Array.isArray(ws)) {
        gameInstance = ws[0].gameInstance;
    } else {
        gameInstance = ws.gameInstance;
    }
    const { multiType, signType, refers } = data;
    switch (multiType) {
        case GAME_MODE.ADVENTURE_GAME: {
            adventureGameHandler(ws, signType, gameInstance, refers);
            break;
        }
        case GAME_MODE.MULTIPLAER_GAME: {
            multiGameHandler(ws, signType, gameInstance, refers);
            break;
        }

        default:
            break;
    }
}
/*********************multi event 辅助函数 ***********************/
const adventureGameHandler = function (ws, signType, gameInstance, refers) {
    switch (signType) {
        case MULTI_CLIENT_TYPE.ADVENTURE_CLIENT_READY: {//客户端准备就绪
            //设置对应客户端连接状态为游戏就绪
            ws.adventureClientIsReady = true;
            break;
        }
        case MULTI_CLIENT_TYPE.ADVENTURE_CLIENT_STAGEISREADY: {//客户端stage就绪
            //设置对应客户端stage为绘制完毕
            ws.adventureDrawStageIsReady = true;
            if (ws.t?.adventureStageIsAllReady(ws.name)) {
                gameInstance.gameState = GAME_STATE_START;
                let wslist = ws.t.adventurePlayerMap.get(ws.name).playerWs;
                //同步客户端数据，开始游戏
                ServerSendMsg(
                    wslist,
                    MSG_TYPE_SERVER.MSG_SYNC_SERVER,
                    new SyncMsg(
                        'game_state',
                        SYNC_SERVER_TYPE.BASIC_DATA_SERVER,
                        { level: 1, target: ["gameState"], value: GAME_STATE_START }
                    )
                );
            }
            break;
        }
        case MULTI_CLIENT_TYPE.ADVENTURE_CLIENT_CLEAR: {//清除客户端游戏数据
            eventBus.emit("clearAdventureData", refers.name);
            break;
        }
        default:
            break;
    }
}
const multiGameHandler = function (ws, signType, gameInstance, refers) {
    switch (signType) {
        case MULTI_CLIENT_TYPE.MULTI_CLIENT_READY: {//客户端准备就绪
            //设置对应客户端连接状态为游戏就绪
            ws.multiClientIsReady = true;
            break;
        }
        case MULTI_CLIENT_TYPE.MULTI_CLIENT_STAGEISREADY: {//客户端stage就绪
            //设置对应客户端stage为绘制完毕
            ws.multiDrawStageIsReady = true;
            if (ws.t?.multiStageIsAllReady(ws.matchCodes)) {
                gameInstance.gameState = GAME_STATE_START;
                let wslist = ws.t.getMultiPlayerMatchWsListByCode(ws.matchCodes);
                //同步客户端数据，开始游戏
                ServerSendMsg(
                    wslist,
                    MSG_TYPE_SERVER.MSG_SYNC_SERVER,
                    new SyncMsg(
                        'game_state',
                        SYNC_SERVER_TYPE.BASIC_DATA_SERVER,
                        { level: 1, target: ["gameState"], value: GAME_STATE_START }
                    )
                );
            }
            break;
        }
        case MULTI_CLIENT_TYPE.MULTI_CLIENT_CLEAR: {//清除客户端游戏数据
            eventBus.emit("clearMultiPlayerData", ws.matchCodes);
            break;
        }
        default:
            break;
    }
}
module.exports = {
    clientMsgHandler,
}