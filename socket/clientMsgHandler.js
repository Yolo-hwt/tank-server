const { MSG_TYPE_CLIENT, KEY_EVENT_TYPE, SYNC_DATA_TYPE } = require("./socketMessage")
const { STATE, KEYBOARD } = require("../hook/globalParams")
const { MSG_BEAT, MSG_KEY, MSG_NORMAL, MSG_SYNC } = MSG_TYPE_CLIENT
const { KEY_EVENT_UP, KEY_EVENT_DOWN } = KEY_EVENT_TYPE
const { STAGE_ISREADY } = SYNC_DATA_TYPE
const {
    GAME_STATE_MENU,
    GAME_STATE_INIT,
    GAME_STATE_OVER,
    GAME_STATE_START,
    GAME_STATE_WIN,
} = STATE;

//根据客户端发送的msg来运行游戏逻辑
//返回客户端相应的控制指令
module.exports.clientMsgHandler = function (cMsg, ws) {
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
    switch (keyType) {
        case KEY_EVENT_DOWN: {
            keydownMsgHandler(ws, data)
            break;
        }
        case KEY_EVENT_UP: {
            keyupMsgHandler(data)
            break;
        }
        default: {
            console.log('keyType匹配失败');
            break;
        }
    }
}
//键盘按下事件
const keydownMsgHandler = function (ws, data) {
    // ws.send(JSON.stringify({ text: "测试消息" }))
    const code = data.code;
    let gameInstance = ws.gameInstance;
    switch (gameInstance.gameState) {
        case GAME_STATE_MENU:
            if (code == KEYBOARD.ENTER) {
                gameInstance.gameState = GAME_STATE_INIT;
                //只有一个玩家
                if (gameInstance.menu.playNum == 1) {
                    gameInstance.player2.lives = 0;
                }

            } else {
                var n = 0;
                if (code == KEYBOARD.DOWN) {
                    n = 1;
                } else if (code == KEYBOARD.UP) {
                    n = -1;
                }

                gameInstance.menu.next(n);
            }
            break;
        case GAME_STATE_START:
            if (!gameInstance.keys.contain(code)) {
                gameInstance.keys.push(code);
            }
            //射击
            if (code == KEYBOARD.SPACE && gameInstance.player1.lives > 0) {
                gameInstance.player1.shoot(BULLET_TYPE_PLAYER);
            } else if (
                code == KEYBOARD.ENTER &&
                gameInstance.player2.lives > 0
            ) {
                gameInstance.player2.shoot(BULLET_TYPE_PLAYER);
            } else if (code == KEYBOARD.N) {
                nextLevel(gameInstance);
            } else if (code == KEYBOARD.P) {
                preLevel(gameInstance);
            }
            break;
    }
}
//键盘回上事件
const keyupMsgHandler = function (data) {
    //console.log(data);
}
//客户端同步数据到服务器
const syncDataMsgHandler = function (ws, data) {
    let gameInstance = ws?.gameInstance;
    const syncType = data.syncType;
    switch (syncType) {
        case STAGE_ISREADY: {
            const isReady = data.refers.isReady ?? false;
            gameInstance.stage.isReady = isReady;
            break;
        }
        default:
            break;
    }
}