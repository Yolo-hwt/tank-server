//模块引入
const http = require('http');
//js引入
require("../utils/Helper")
//类引入
const { WebSocketServer } = require("./webSocketServer")
//socketMessage
//全局变量引入
const { GAME_MODE } = require("../hook/globalParams")
//多人游戏匹配方法引入
const {
    matchAdventureGameByCodes,
    matchMultiplayerGameByCodes,
    adventureGameLoop,
    initAdventureData
} = require("../hook/multiplayerGameLogic")

//eventBus
const { eventBus } = require("../hook/eventBus");
eventsOn();
//静态参数
const port = 1024//端口
const pathname = '/ws/'//访问路径
const matchTime = 15;
const server = http.createServer()
const webSocketServer = new WebSocketServer({ noServer: true })
const adventureGameList = new Map();

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
        webSocketServer.addClient(ws);
        //设置socket，代理ws
        webSocketServer.ws = ws
        switch (mode) {
            case GAME_MODE.ADVENTURE_GAME: {
                matchAdventureGameByCodes(ws, matchTime);
                break;
            }
            case GAME_MODE.MULTIPLAER_GAME: {
                matchMultiplayerGameByCodes()
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
    eventBus.on("clearAdventureLoop", (key) => {
        clearInterval(adventureGameList.get(key).loopid)
        adventureGameList.delete(key);
    });
}
//开始adventure game
function startAdventureGame(name) {
    const playerWs = webSocketServer.getClientByName(name);
    if (!playerWs) {//若找不到客户端连接
        return;
    }
    if (playerWs.gameInstance) { //若已有游戏实体则说明已经创建游戏循环成功，
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
}