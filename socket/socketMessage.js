/************服务器消息类型***/
const MSG_TYPE_SERVER = {
    MSG_OPERA_DRAW: "opera_draw",
    MSG_SYNC_SERVER: "sync_server_data",    //同步服务器端数据
    MSG_OPERA_AUDIO: "opera_audio",
    MSG_OPERA_CLEAR: "opera_clear",
    MSG_MULTI_SIGN: "multi_sign",//多人游戏标识
}
const OPERA_CLEAR_TYPE = {
    TANKCTX_CLEAR: 'tanctx_clear',
    OVERCTX_CLEAR: "overctx_clear",
    ENEMYNUM_CLEAR: 'enemynum_clear',
}
//绘制操作类型，以绘制目标作为区分
//对应drawMsg中的drawType
const OPERA_DRAW_TYPE = {

}

//数据同步操作
//对应SyncMsg中的syncType
const SYNC_SERVER_TYPE = {
    BASIC_DATA_SERVER: "basic_data_server",
    CRACK_ADD: "crack_add",
    PROP_ADD: "prop_add",
    ENEMYTANK_ADD: 'add_enemyTank',
    BULLET_ADD: 'bullet_add',
    MAP_UPDATE: "map_update",
    PLAYER_MOVE: "player_move",
    BULLET_MOVE: 'bullet_move',
    AITANK_MOVE: "aitank_move",
    PLAYER_RENASCENC: "player_renascenc",
    SKIP_LEVEL: "skip_level",
    ENEMYTANK_REMOVE: 'remove_enemyTank',
    BULLET_REMOVE: 'remove_bullet',
    PLAYER_PROTECTED: "player_protected"
}

//音频播放操作
//对应audioType/Mode
const OPERA_AUDIO_TYPE = {
    //Mode
    AUDIO_PLAY: 'audio_play',
    AUDIO_STOP: "audio_stop",
    //audioType
    AUDIO_ATTACK: "audio_attack",
    AUDIO_TANK_DESTROY: "audio_tankdestory",
    AUDIO_PLAYER_DESTORY: "audio_playerdestory",
    AUDIO_BULLET_DESTORY: 'audio_bulletdestory',
    AUDIO_PROP: "audio_prop",
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
const SYNC_CLIENT_TYPE = {
    STAGE_ISREADY: 'stage.isReady',
    PLAYER_DRAW: "player_draw",
    BASIC_DATA_CLIENT: "basic_data_client",
    PLAYER_PROTECTED: "player_protected",
    OVERANIMATE_ISOK: "over_animation_is_ok",
    ENEMY_ISAPPEAR: "enemy_isappear",
}
//多人游戏标识类型
const MULTI_SIGN_TYPE = {
    ADVENTURE_MATCH_OK: "adventure_match_ok",
    ADVENTURE_MATCH_NO: "adventure_match_no",
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
const DrawMsg = function (msg, drawType, refers = {}) {
    NormalMsg.call(this, msg);
    this.drawType = drawType;
    this.refers = refers;
}

//同步数据
const SyncMsg = function (msg, syncType, refers = {}) {
    NormalMsg.call(this, msg);
    this.syncType = syncType;
    this.refers = refers;
}
//音频播放
const AudioMsg = function (msg, audioType, audioMode) {
    NormalMsg.call(this, msg);
    this.audioType = audioType;
    this.audioMode = audioMode;
}
const MultiMsg = function (msg, multiType, signType, refers = {}) {
    NormalMsg.call(this, msg);
    this.multiType = multiType;
    this.signType = signType;
    this.refers = refers;
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
    SYNC_CLIENT_TYPE,
    SYNC_SERVER_TYPE,
    OPERA_AUDIO_TYPE,
    OPERA_CLEAR_TYPE,
    MULTI_SIGN_TYPE,
    NormalMsg,
    DrawMsg,
    SyncMsg,
    AudioMsg,
    MultiMsg,
    ServerSendMsg
}