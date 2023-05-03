//全局变量引入
const { TAGS } = require("../hook/globalParams");
const { CheckIntersect } = require("../utils/Collision");
const { GRID } = TAGS
//socketMessage引入
const {
	ServerSendMsg, DrawMsg, AudioMsg,
	MSG_TYPE_SERVER,
	OPERA_CLEAR_TYPE, OPERA_DRAW_TYPE, OPERA_AUDIO_TYPE
} = require("../socket/socketMessage")
//相关方法引入
const { clearRectByCtxName, controlAudioPlay } = require("../hook/gameLogic")

module.exports.Prop = function (gameInstance) {
	this.x = 0;
	this.y = 0;
	this.duration = 600;
	this.type = 0;
	this.hit = false;
	this.width = 30;
	this.height = 28;
	//this.ctx = gameInstance.overCtx;
	this.isDestroyed = false;
	this.size = 28;

	this.init = function (ws) {
		//this.ctx.clearRect(this.x, this.y, this.width, this.height);
		clearRectByCtxName(ws, OPERA_CLEAR_TYPE.OVERCTX_CLEAR)
		this.duration = 600;
		this.type = parseInt(Math.random() * 6);
		this.x = parseInt(Math.random() * 384) + gameInstance.map.offsetX;
		this.y = parseInt(Math.random() * 384) + gameInstance.map.offsetY;
		this.isDestroyed = false;
	};

	this.draw = function (ws, gameInstance) {
		if (this.duration > 0 && !this.isDestroyed) {
			//this.ctx.drawImage(RESOURCE_IMAGE, POS["prop"][0] + this.type * this.width, POS["prop"][1], this.width, this.height, this.x, this.y, this.width, this.height);
			const { type, x, y } = this;
			ServerSendMsg(
				ws,
				MSG_TYPE_SERVER.MSG_OPERA_DRAW,
				new DrawMsg('prop_draw', OPERA_DRAW_TYPE.PROP_DRAW, { type, x, y })
			);
			this.duration--;
			this.isHit(ws, gameInstance);
		} else {
			//this.ctx.clearRect(this.x, this.y, this.width, this.height);
			clearRectByCtxName(ws, OPERA_CLEAR_TYPE.OVERCTX_CLEAR)
			this.isDestroyed = true;
		}
	};

	this.isHit = function (ws, gameInstance) {
		var player = null;
		if (gameInstance.player1.lives > 0 && CheckIntersect(this, gameInstance.player1, 0)) {
			this.hit = true;
			player = gameInstance.player1;
		} else if (gameInstance.player2.lives > 0 && CheckIntersect(this, gameInstance.player2, 0)) {
			this.hit = true;
			player = gameInstance.player2;
		}
		if (this.hit) {
			//PROP_AUDIO.play();
			controlAudioPlay(ws, 'prop_audio', OPERA_AUDIO_TYPE.AUDIO_PROP, OPERA_AUDIO_TYPE.AUDIO_PLAY)
			this.isDestroyed = true;
			//this.ctx.clearRect(this.x, this.y, this.width, this.height);
			clearRectByCtxName(ws, OPERA_CLEAR_TYPE.OVERCTX_CLEAR)
			switch (this.type) {
				case 0:
					player.lives++;
					break;
				case 1:
					gameInstance.emenyStopTime = 500;
					break;
				case 2:
					var mapChangeIndex = [[23, 11], [23, 12], [23, 13], [23, 14], [24, 11], [24, 14], [25, 11], [25, 14]];
					//gameInstance.map.updateMap(mapChangeIndex, GRID);
					let indexArr = mapChangeIndex;
					let target = GRID
					ServerSendMsg(
						ws,
						MSG_TYPE_SERVER.MSG_SYNC_SERVER,
						new SyncMsg('map_update', SYNC_SERVER_TYPE.MAP_UPDATE, { indexArr, target })
					);
					gameInstance.homeProtectedTime = 500;
					break;
				case 3:
					if (gameInstance.enemyArray != null || gameInstance.enemyArray.length > 0) {
						for (let i = 0; i < gameInstance.enemyArray.length; i++) {
							var enemyObj = gameInstance.enemyArray[i];
							enemyObj.distroy(gameInstance, i);
						}
					}
					break;
				case 4:
					break;
				case 5:
					player.isProtected = true;
					player.protectedTime = 500;
					break;

			}
		}
	};
};