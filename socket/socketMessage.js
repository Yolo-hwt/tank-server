/************服务器消息类型***/
const MSG_TYPE_SERVER = {
    MSG_OPERA_DRAW: "opera_draw"
}

//绘制操作类型，以绘制目标作为区分
//对应drawMsg中的drawType
const OPERA_DRAW_TYPE = {
    MENU_DRAW: 'menu_draw',
    STAGE_DRAW: 'stage_draw',
    TANKCTX_CLEAR: 'tanctx_clear',
    PLAYER1_DRAW: 'player1_draw',
    PLAYER2_DRAW: 'player2_draw'
}


/**************客户端消息类型**/
const MSG_TYPE_CLIENT = {
    MSG_NORMAL: 'normal',   //普通消息
    MSG_SYNC: 'syncdata',   //同步客户端数据到服务器
    MSG_BEAT: 'heartbeat',  //心跳包
    MSG_KEY: 'keyevent'     //键盘事件
}
//键盘事件类型，按下或回上
const KEY_EVENT_TYPE = {
    KEY_EVENT_DOWN: 'keydown',
    KEY_EVENT_UP: 'keyup',
}
const SYNC_DATA_TYPE = {
    STAGE_ISREADY: 'stage.isReady',
}


//消息实体
//与设备交互的消息主体，通用类
const SocketMessage = function (from = "", id = "", type = "", data = {}) {
    this.from = (from == undefined || from == null) ? '' : from;     //发送方为
    this.id = id;          //发送消息的设备名称
    this.type = type;         //消息类型
    this.data = data           //消息体
}

//普通消息
const NormalMsg = function (msg) {
    this.msg = msg ?? '';
}

//绘制操作
const DrawMsg = function (msg, drawType) {
    NormalMsg.call(this, msg);
    this.drawType = drawType;
}

//服务器发送消息
const ServerSendMsg = function (ws, type, data) {
    let msgContent = new SocketMessage("server", "server", type, data);
    ws.send(JSON.stringify(msgContent))
}

module.exports = {
    MSG_TYPE_SERVER,
    MSG_TYPE_CLIENT,
    KEY_EVENT_TYPE,
    OPERA_DRAW_TYPE,
    SYNC_DATA_TYPE,
    NormalMsg,
    DrawMsg,
    ServerSendMsg
}