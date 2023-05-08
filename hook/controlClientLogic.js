const {
    ServerSendMsg,
    DrawMsg, AudioMsg,
    MSG_TYPE_SERVER,
    OPERA_CLEAR_TYPE
} = require("../socket/socketMessage")
//控制音频播放
const controlAudioPlay = function (ws, msg, audioType, audioMode) {
    ServerSendMsg(
        ws,
        MSG_TYPE_SERVER.MSG_OPERA_AUDIO,
        new AudioMsg(msg, audioType, audioMode)
    );
};
//根据图层名称指示客户端清除画布
const clearRectByCtxName = function (ws, ctxName) {
    switch (ctxName) {
        case OPERA_CLEAR_TYPE.TANKCTX_CLEAR: {
            ServerSendMsg(
                ws,
                MSG_TYPE_SERVER.MSG_OPERA_CLEAR,
                new DrawMsg('tankctx_clear', OPERA_CLEAR_TYPE.TANKCTX_CLEAR)
            );
            break;
        }
        case OPERA_CLEAR_TYPE.OVERCTX_CLEAR: {
            ServerSendMsg(
                ws,
                MSG_TYPE_SERVER.MSG_OPERA_CLEAR,
                new DrawMsg('overctx_clear', OPERA_CLEAR_TYPE.OVERCTX_CLEAR)
            );
            break;
        }
        default:
            break;
    }

};
module.exports = {
    clearRectByCtxName,
    controlAudioPlay
}