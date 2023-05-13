const WebSocket = require('ws');

const { clientMsgHandler } = require("./clientMsgHandler")
class WebSocketServer extends WebSocket.Server {
    constructor() {
        super(...arguments);
        this.webSocketClient = {}//存放已连接的客户端
        this.adventurePlayerMap = new Map();//存放双人游戏匹配到的客户端
        this.multiplayerMap = new Map();//存放四人游戏匹配到的客户端
    }

    set ws(val) {//代理当前的ws，赋值时将其初始化
        //即，将当前ws设置为val(新的一个连接ws)，并将val.t指向this(WebSocketServer)
        this._ws = val
        val.t = this;
        val.on('error', this.errorHandler)
        val.on('close', this.closeHandler)
        val.on('message', this.messageHandler)
    }

    get ws() {
        return this._ws
    }
    sendMsg(obj) {
        this.t.send(JSON.stringify(obj))
    }
    getMsg(e) {
        //console.log(e);
        return JSON.parse(e);
    }

    messageHandler(e) {
        const cmsg = this.t.getMsg(e);
        // console.log(cmsg);
        const name = cmsg.name ?? "";
        //此处无法直接通过this.webSocketClient访问是因为此时的this是ws
        clientMsgHandler(cmsg, this.t.webSocketClient[name]);
    }

    errorHandler(e) {
        this.t.removeClient(this)
        console.info('客户端出错')
    }

    closeHandler(e) {
        this.t.removeClient(this)
        console.info('客户端已断开')
    }
    //clients
    getClients() {
        return this.webSocketClient;
    }
    getClientByName(name) {
        return this.webSocketClient[name];
    }
    addClient(item) {//设备上线时添加到客户端列表
        if (this.webSocketClient[item['name']]) {
            console.log(item['name'] + '客户端已存在')
            //this.webSocketClient[item['name']].close()
        }
        this.webSocketClient[item['name']] = item
        console.log(item['name'] + '客户端已添加')
    }
    removeClient(item) {//设备断线时从客户端列表删除
        if (!this.webSocketClient[item['name']]) {
            console.log(item['name'] + '客户端不存在')
            return;
        }
        //移除客户端时候，清除游戏循环计时器
        const clearid = this.webSocketClient[item['name']].gameLoopId
        clearInterval(clearid);

        this.webSocketClient[item['name']] = null
        console.log(item['name'] + '客户端已移除')
    }
    getAdventureMap() {
        return this.adventurePlayerMap;
    }
    //adventure players
    addAdventure(nameArr) {//以客户端name为key，匹配总数组为value
        for (let i = 0; i < nameArr.length; i++) {
            this.adventurePlayerMap.set(nameArr[i], nameArr.slice());
        }
    }
    removeAdventure(name) {
        let players = this.adventurePlayerMap.get(name);
        for (let i = 0; i < players.length; i++) {
            if (players[i] == name) {
                this.adventurePlayerMap.delete(players[i]);
            } else {
                //因为只有两个玩家，某一方下线则仅剩另一方为一个数组
                this.adventurePlayerMap.set(players[i], [players[i]]);
            }
        }
    }
}//webSocketServer

module.exports = { WebSocketServer };