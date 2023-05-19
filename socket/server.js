//模块引入
const http = require('http');
//js引入
require("../utils/Helper")
//类引入
const { WebSocketServer } = require("./webSocketServer")
//socketMessage
//全局变量引入
const { GAME_MODE, MULTIPLAYER_DATA } = require("../hook/globalParams")
//多人游戏匹配方法引入
const {
    matchAdventureGameByCodes,
    matchMultiplayerGameByCodes,
    adventureGameLoop,
    initAdventureData,
    initMultiplayerData,
    multiplayerGameLoop
} = require("../hook/multiplayerGameLogic")
//socketMessage
const {
    ServerSendMsg,
    SyncMsg,
    SYNC_SERVER_TYPE,
    MSG_TYPE_SERVER,
} = require("./socketMessage")
//eventBus
const { eventBus } = require("../hook/eventBus");
eventsOn();
//静态参数
const port = 1024//端口
const pathname = '/ws/'//访问路径
// const matchTime = 5;
const server = http.createServer()
const webSocketServer = new WebSocketServer({ noServer: true })
//key:name + partnerName value:{ player1: name, player2: partnerName, loopid }
const adventureGameList = new Map();

const multiplayerGameList = new Map();

//通过http.server监听upgrade事件配合URL类过滤数据
server.on("upgrade", (req, socket, head) => {
    let url = new URL(req.url, `http://${req.headers.host}`)
    let name = url.searchParams.get('name')//获取连接标识
    let mode = url.searchParams.get('mode')//获取游戏模式
    let code = url.searchParams.get('code')//获取房间匹配字符串
    if (!checkUrl(url.pathname, pathname)) {//未按标准
        socket.write('conect error:client url formatting error', url);
        socket.destroy();
        return;
    }
    //
    webSocketServer.handleUpgrade(req, socket, head, function (ws) {
        //客户端name和matchCodes
        ws.name = name;
        ws.matchCodes = code;
        ws.gameMode = mode;
        webSocketServer.addClient(ws);
        //设置socket，代理ws
        webSocketServer.ws = ws
        switch (mode) {
            case GAME_MODE.ADVENTURE_GAME: {
                matchAdventureGameByCodes(ws, MULTIPLAYER_DATA.MATCH_ADVENTURE_TIMES);
                break;
            }
            case GAME_MODE.MULTIPLAER_GAME: {
                matchMultiplayerGameByCodes(ws, MULTIPLAYER_DATA.MATCH_MULTI_TIMES);
                break;
            }
            default:
                break;
        }


    });
})

//服务器启动
server.listen(port, () => {
    console.log('tank-server start watting for connect...')
})

//验证url标准
function checkUrl(url, key) {//判断url是否包含key
    return - ~url.indexOf(key)
}

//事件挂载
function eventsOn() {
    eventBus.on("startAdventure", (name) => startAdventureGame(name));
    eventBus.on("startMultiPlayer", (name) => startMultiPlayerGame(name));
    eventBus.on("clearAdventureData", (name) => {
        clearAdventureGameData(name);
    });
    eventBus.on("clearMultiPlayerData", (matchCodes) => {
        clearMultiPlayerGameData(matchCodes);
    });

}
//开始adventure game
function startAdventureGame(name) {
    const playerWs = webSocketServer.getClientByName(name);
    if (!playerWs) {//若找不到客户端连接
        return;
    }
    if (playerWs.gameInstance != null || playerWs.gameInstance != undefined) { //若已有游戏实体则说明已经创建游戏循环成功，
        return;
    }
    //获取partner连接实体
    const { players, partnerIndex } = webSocketServer.getAdventureMap().get(name);
    const partnerName = players[partnerIndex];
    const partnerWs = webSocketServer.getClientByName(partnerName);
    if (!partnerWs) {
        return;
    }
    //为两者添加游戏实体，开启游戏循环
    const gameInstance = initAdventureData();
    playerWs.gameInstance = gameInstance;
    partnerWs.gameInstance = gameInstance;
    //规定每个ws对应哪个player
    playerWs.playerIndex = 1;
    partnerWs.partnerIndex = 2;
    //开启游戏循环
    const loopid = setInterval(() => {
        //查询双方客户端是否已经准备就绪
        if (!(webSocketServer.adventurePlayersIsAllReady(name))) {
            return;
        }
        adventureGameLoop([playerWs, partnerWs], gameInstance);
    }, 20);
    //添加到looplist
    adventureGameList.set("" + name + partnerName, { player1: name, player2: partnerName, loopid });
    adventureGameList.set("" + partnerName + name, { player1: name, player2: partnerName, loopid });
}
//清除客户端游戏数据
function clearAdventureGameData(name) {
    let playerMap = {};
    playerMap = webSocketServer.getAdventureMap();
    //清除adventureGameList
    const playerWs = playerMap.get(name)?.playerWs;
    const players = playerMap.get(name)?.players;
    if (!players || !playerWs) {
        //说明已经清除了
        return;
    }
    //重置playerws标识
    for (let i = 0; i < playerWs.length; i++) {
        playerWs[i].matchCodes = "";
        playerWs[i].adventureClientIsReady = false;//标识参与双人冒险的客户端是否已经准备好
        playerWs[i].adventureDrawStageIsReady = false;//标识客户端stage绘制完毕
        playerWs[i].close();
    }
    const gameListkey1 = players[0] + players[1];
    const gameListkey2 = players[1] + players[0];
    //两个client共有一个循环，清楚一次即可
    clearInterval(adventureGameList.get(gameListkey1).loopid);
    //清除list
    adventureGameList.delete(gameListkey1);
    adventureGameList.delete(gameListkey2);

    //清除webSocketServer.adventurePlayerMap
    webSocketServer.getAdventureMap().delete(players[0]);
    webSocketServer.getAdventureMap().delete(players[1]);

    //
    console.log(players, "clear adventure data");
}
//开启multiplayer游戏
function startMultiPlayerGame(name) {
    const playerWs = webSocketServer.getClientByName(name);
    if (!playerWs) {//若找不到客户端连接
        return;
    }
    if (playerWs.gameInstance != null || playerWs.gameInstance != undefined) { //若已有游戏实体则说明已经创建游戏循环成功，
        return;
    }
    const matchCodes = playerWs.matchCodes;
    //获取其余匹配对象连接实体
    const { players } = webSocketServer.getMultiPlayerGameByMatchCode(matchCodes);
    const clients = webSocketServer.getMultiPlayerMatchWsListByCode(matchCodes);
    //添加游戏实体
    const gameInstance = initMultiplayerData(clients.length);
    for (let i = 0; i < clients.length; i++) {
        if (clients[i]) {
            clients[i].gameInstance = gameInstance;
            //为玩家添加基础生命值
            gameInstance["player" + (i + 1)].lives = MULTIPLAYER_DATA.PLAYER_LIVES;

        }
    }
    let isSyncPlayerLives = false;
    //开启游戏循环
    const loopid = setInterval(() => {
        //查询双方客户端是否已经准备就绪
        if (!(webSocketServer.multiPlayersIsAllReady(matchCodes))) {
            return;
        }
        //就绪之后，同步客户端玩家生命值
        if (!isSyncPlayerLives) {
            for (let i = 0; i < clients.length; i++) {
                if (clients[i]) {
                    //客户端同步玩家生命值
                    ServerSendMsg(
                        clients,
                        MSG_TYPE_SERVER.MSG_SYNC_SERVER,
                        new SyncMsg(
                            'player' + (i + 1) + '_lives',
                            SYNC_SERVER_TYPE.BASIC_DATA_SERVER,
                            { level: 2, target: ["player" + (i + 1), "lives"], value: MULTIPLAYER_DATA.PLAYER_LIVES }
                        )
                    );
                }
            }
            isSyncPlayerLives = true;
        }
        // console.log("start Multi");
        multiplayerGameLoop(webSocketServer.getMultiPlayerMatchWsListByCode(matchCodes), gameInstance);
    }, 20);
    //添加到looplist
    multiplayerGameList.set("" + matchCodes, { players, loopid });

}
//清除多人游戏数据
function clearMultiPlayerGameData(matchCodes) {

    const matchGameMap = webSocketServer.getMultiPlayerGameMap();
    const matchGame = matchGameMap.get(matchCodes);
    if (!matchGame) {
        //说明已经清除了
        return;
    }
    console.log("matchCodes: " + matchCodes + "多人游戏对局结束，清除游戏数据");
    const matchPlayerWsList = webSocketServer.getMultiPlayerMatchWsListByCode(matchCodes);
    const players = matchGame?.players;
    const playerNum = matchGame?.playerNum ?? 0;
    //重置playerws标识
    for (let i = 0; i < playerNum; i++) {
        matchPlayerWsList[i].matchCodes = "";
        matchPlayerWsList[i].multiClientIsReady = false;//标识参与多人对战的客户端是否已经准备好
        matchPlayerWsList[i].multiDrawStageIsReady = false;//标识客户端stage绘制完毕
        matchPlayerWsList[i].close();
    }
    //清除multiplayerGameList和multiPlayerGameMap

    //四个client共有一个循环，清楚一次即可
    clearInterval(multiplayerGameList.get(matchCodes).loopid);
    adventureGameList.delete(matchCodes);
    matchGameMap.delete(matchCodes);
    //
    console.log(players, "clear multiplayer data");
}