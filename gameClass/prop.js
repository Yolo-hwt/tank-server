//全局变量引入
const { TAGS } = require("../hook/globalParams");
const { CheckIntersect } = require("../utils/Collision");
const { GRID } = TAGS
//socketMessage引入
const {
	ServerSendMsg,
	SyncMsg,
	MSG_TYPE_SERVER,
	SYNC_SERVER_TYPE, OPERA_AUDIO_TYPE
} = require("../socket/socketMessage")
//相关方法引入
const { clearRectByCtxName, controlAudioPlay } = require("../hook/controlClientLogic")

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

	this.init = function () {
		this.duration = 600;
		this.type = parseInt(Math.random() * 6);
		// this.type = 5;
		this.x = parseInt(Math.random() * 384) + gameInstance.map.offsetX;
		this.y = parseInt(Math.random() * 384) + gameInstance.map.offsetY;
		this.isDestroyed = false;
	};

	this.draw = function (ws, gameInstance) {
		if (this.duration > 0 && !this.isDestroyed) {
			this.duration--;
			this.isHit(ws, gameInstance);
		} else {
			this.isDestroyed = true;
		}
		if (this.isDestroyed == true) {
			//通知客户端更新prop.isDestroyed状态
			ServerSendMsg(
				ws,
				MSG_TYPE_SERVER.MSG_SYNC_SERVER,
				new SyncMsg(
					'prop_destroy',
					SYNC_SERVER_TYPE.BASIC_DATA_SERVER,
					{ level: 2, target: ["prop", "isDestroyed"], value: true }
				)
			);
		}
	};

	this.isHit = function (ws, gameInstance) {
		var player = null;
		let playerIndex = 1;
		if (gameInstance.player1.lives > 0 && CheckIntersect(this, gameInstance.player1, 0)) {
			this.hit = true;
			player = gameInstance.player1;
		} else if (gameInstance.player2.lives > 0 && CheckIntersect(this, gameInstance.player2, 0)) {
			this.hit = true;
			playerIndex = 2;
			player = gameInstance.player2;
		}
		if (this.hit) {
			//PROP_AUDIO.play();
			controlAudioPlay(ws, 'prop_audio', OPERA_AUDIO_TYPE.AUDIO_PROP, OPERA_AUDIO_TYPE.AUDIO_PLAY)
			this.isDestroyed = true;
			switch (this.type) {
				case 0://生命++
					player.lives++;
					ServerSendMsg(
						ws,
						MSG_TYPE_SERVER.MSG_SYNC_SERVER,
						new SyncMsg(
							'prop0_playerlives++',
							SYNC_SERVER_TYPE.BASIC_DATA_SERVER,
							{ level: 2, target: ["player" + playerIndex, "lives"], value: player.lives }
						)
					);
					break;
				case 1://敌人停滞
					gameInstance.emenyStopTime = 500;
					break;
				case 2://铜墙铁壁home
					var mapChangeIndex = [[23, 11], [23, 12], [23, 13], [23, 14], [24, 11], [24, 14], [25, 11], [25, 14]];
					gameInstance.map.updateMap(mapChangeIndex, GRID);
					//通知客户端更新home
					let indexArr = mapChangeIndex;
					let target = GRID
					ServerSendMsg(
						ws,
						MSG_TYPE_SERVER.MSG_SYNC_SERVER,
						new SyncMsg('map_update', SYNC_SERVER_TYPE.MAP_UPDATE, { indexArr, target })
					);
					gameInstance.homeProtectedTime = 500;
					break;
				case 3://一键清屏
					if (gameInstance.enemyArray != null || gameInstance.enemyArray.length > 0) {
						for (let i = 0; i < gameInstance.enemyArray.length; i++) {
							var enemyObj = gameInstance.enemyArray[i];
							//params(ws, gameInstance, type, tankIndex)
							enemyObj.distroy(ws, gameInstance, 2, i);
						}
					}
					break;
				case 4:
					break;
				case 5://无敌金身
					player.isProtected = true;
					player.protectedTime = 500;
					ServerSendMsg(
						ws,
						MSG_TYPE_SERVER.MSG_SYNC_SERVER,
						new SyncMsg('player_protected', SYNC_SERVER_TYPE.PLAYER_PROTECTED, { index: playerIndex, state: true, time: 500 })
					);
					break;
			}
		}
	};
};