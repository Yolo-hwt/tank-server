const WebSocket = require('ws');

const { clientMsgHandler } = require("./clientMsgHandler");
const { MSG_TYPE_CLIENT } = require('./socketMessage');
class WebSocketServer extends WebSocket.Server {
    constructor() {
        super(...arguments);
        this.webSocketClient = {}//存放已连接的客户端
        // key:name;
        // value:{ isReady: false, players: [player1, player2], playerWs: [clients[name], client],curPlayerIndex: 0, partnerIndex: 1 }
        this.adventurePlayerMap = new Map();//存放双人游戏匹配到的客户端
        this.multiplayerMap = new Map();//存放四人游戏匹配到的客户端
    }

    set ws(val) {//代理当前的ws，赋值时将其初始化
        //即，将当前ws设置为val(新的一个连接ws)，并将val.t指向this(WebSocketServer)
        this._ws = val;
        val.adventureClientIsReady = false;//标识参与双人冒险的客户端是否已经准备好
        val.adventureDrawStageIsReady = false;//标识客户端stage绘制完毕
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
        const wslist = this.t.adventurePlayerMap.get(name)?.playerWs;

        const ws = this.t.webSocketClient[name];
        // if (cmsg.type == MSG_TYPE_CLIENT.MSG_KEY) {
        //     console.log(name);
        // }
        if (this.t.adventureStageIsAllReady(name)) {
            clientMsgHandler(cmsg, wslist);
        } else {
            //此处无法直接通过this.webSocketClient访问是因为此时的this是ws
            clientMsgHandler(cmsg, ws);
        }
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
    //
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
    addAdventure(player, value) {
        this.adventurePlayerMap.set(player, value);
    }
    //
    removeAdventure(name) {
        let playerObj = this.adventurePlayerMap.get(name);
        if (playerObj) {
            let { players, curPlayerIndex, partnerIndex } = playerObj
            this.adventurePlayerMap.delete(players[curPlayerIndex]);
            //更新partner
            const partnerName = players[partnerIndex];
            let partnerObj = this.adventurePlayerMap.get(partnerName);
            if (partnerObj) {
                //移除name后其pantner也对应改变
                const newVal = { players: [partnerName], curPlayerIndex: 0, partnerIndex: 0 };
                newVal.isReady = partnerObj.isReady;
                this.adventurePlayerMap.set(partnerName, newVal);
            }
        }
    }
    adventurePlayersIsAllReady(name) {
        const playerWs = this.webSocketClient[name];
        const playerObj = this.adventurePlayerMap.get(name);
        if (!playerObj) {
            return false;
        }
        const { players, partnerIndex } = playerObj;
        const partnerWs = this.webSocketClient[players[partnerIndex]];
        if (playerWs && partnerWs) {
            return playerWs.adventureClientIsReady && partnerWs.adventureClientIsReady;
        }
        return false;
    }
    adventureStageIsAllReady(name) {
        const playerWs = this.webSocketClient[name];
        const playerObj = this.adventurePlayerMap.get(name);
        if (!playerObj) {
            return false;
        }
        const { players, partnerIndex } = playerObj;
        const partnerWs = this.webSocketClient[players[partnerIndex]];
        if (playerWs && partnerWs) {
            return playerWs.adventureDrawStageIsReady && partnerWs.adventureDrawStageIsReady;
        }
        return false;
    }
}//webSocketServer

module.exports = { WebSocketServer };