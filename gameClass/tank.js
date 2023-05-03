//全局变量引入
const { POS, DIRECT, PICTURES, SOUNDS, CRACK_TYPE } = require("../hook/globalParams");
const { UP, DOWN, LEFT, RIGHT } = DIRECT;
//工具函数引入
const { CrackAnimation } = require("../utils/crackAnimation")
const { tankMapCollision } = require("../utils/Collision")
//外部类引入
const { Bullet } = require("../gameClass/bullet")
//socketMessage变量引入
const {
	MSG_TYPE_SERVER,
	OPERA_DRAW_TYPE,
	SYNC_SERVER_TYPE,
	OPERA_AUDIO_TYPE,
	AudioMsg,
	SyncMsg,
	DrawMsg,
	ServerSendMsg
} = require("../socket/socketMessage")
//
const { controlAudioPlay } = require("../hook/gameLogic")
/**
 * 坦克基类
 * ..returns
 */
var Tank = function () {
	this.x = 0;
	this.y = 0;
	this.size = 32;//坦克的大小
	this.dir = UP;//方向0：上 1：下 2：左3：右
	this.speed = 1;//坦克的速度
	this.frame = 0;//控制敌方坦克切换方向的时间
	this.hit = false; //是否碰到墙或者坦克
	this.isAI = false; //是否自动
	this.isShooting = false;//子弹是否在运行中
	this.bullet = null;//子弹
	this.shootRate = 0.6;//射击的概率
	this.isDestroyed = false;
	this.tempX = 0;
	this.tempY = 0;

	this.shoot = function (ws, gameInstance, tankIndex, type) {
		if (this.isAI && gameInstance.emenyStopTime > 0) {
			return;
		}
		if (this.isShooting) {
			return;
		} else {
			var tempX = this.x;
			var tempY = this.y;
			this.bullet = new Bullet(this, type, this.dir);
			if (this.dir == UP) {
				tempX = this.x + parseInt(this.size / 2) - parseInt(this.bullet.size / 2);
				tempY = this.y - this.bullet.size;
			} else if (this.dir == DOWN) {
				tempX = this.x + parseInt(this.size / 2) - parseInt(this.bullet.size / 2);
				tempY = this.y + this.size;
			} else if (this.dir == LEFT) {
				tempX = this.x - this.bullet.size;
				tempY = this.y + parseInt(this.size / 2) - parseInt(this.bullet.size / 2);
			} else if (this.dir == RIGHT) {
				tempX = this.x + this.size;
				tempY = this.y + parseInt(this.size / 2) - parseInt(this.bullet.size / 2);
			}
			//下发子弹的坐标
			this.bullet.x = tempX;
			this.bullet.y = tempY;
			//需要告知客户端指定哪一个坦克生成bullet
			let refers = { tankIndex: tankIndex, type: type, dir: this.dir };
			ServerSendMsg(
				ws,
				MSG_TYPE_SERVER.MSG_SYNC_SERVER,
				new SyncMsg('bullet_create', SYNC_SERVER_TYPE.BULLET_CREATE, refers)
			);
			if (!this.isAI) {
				//通知客户端play
				//ATTACK_AUDIO.play();
				controlAudioPlay(ws, 'attack_audio', OPERA_AUDIO_TYPE.AUDIO_ATTACK, OPERA_AUDIO_TYPE.AUDIO_PLAY)
			}
			gameInstance.bulletArray.push(this.bullet);
			this.bullet.draw(ws, gameInstance, gameInstance.bulletArray.length - 1);
			//将子弹加入的子弹数组中
			this.isShooting = true;
		}
	}
	/**
	  * 坦克被击毁
	  */
	this.distroy = function (gameInstance, tankIndex) {
		this.isDestroyed = true;
		const crackType = CRACK_TYPE.CRACK_TYPE_TANK
		gameInstance.crackArray.push(new CrackAnimation(crackType, this));
		//客户端同步添加爆炸动画Obj
		ServerSendMsg(
			ws,
			MSG_TYPE_SERVER.MSG_SYNC_SERVER,
			new SyncMsg('add_crack_tank', SYNC_SERVER_TYPE.CRACK_ADD, { crackType, tankType: this.type, tankIndex })
		);
		//TANK_DESTROY_AUDIO.play();
		//客户端播放坦克销毁音频
		controlAudioPlay(ws, 'tankdestroy_audio', OPERA_AUDIO_TYPE.AUDIO_TANK_DESTROY, OPERA_AUDIO_TYPE.AUDIO_PLAY)
	};

	//坦克移动
	this.move = function (gameInstance) {
		//如果是AI坦克，在一定时间或者碰撞之后切换方法
		if (this.isAI && gameInstance.emenyStopTime > 0) {
			return;
		}
		this.tempX = this.x;
		this.tempY = this.y;

		if (this.isAI) {
			this.frame++;
			if (this.frame % 100 == 0 || this.hit) {
				this.dir = parseInt(Math.random() * 4);//随机一个方向
				this.hit = false;
				this.frame = 0;
			}
		}
		if (this.dir == UP) {
			this.tempY -= this.speed;
		} else if (this.dir == DOWN) {
			this.tempY += this.speed;
		} else if (this.dir == RIGHT) {
			this.tempX += this.speed;
		} else if (this.dir == LEFT) {
			this.tempX -= this.speed;
		}
		this.isHit(gameInstance);
		if (!this.hit) {
			this.x = this.tempX;
			this.y = this.tempY;
		}
	};
	/**
	 * 碰撞检测
	 */
	this.isHit = function (gameInstance) {
		//临界检测
		if (this.dir == LEFT) {
			if (this.x <= gameInstance.map.offsetX) {
				this.x = gameInstance.map.offsetX;
				this.hit = true;
			}
		} else if (this.dir == RIGHT) {
			if (this.x >= gameInstance.map.offsetX + gameInstance.map.mapWidth - this.size) {
				this.x = gameInstance.map.offsetX + gameInstance.map.mapWidth - this.size;
				this.hit = true;
			}
		} else if (this.dir == UP) {
			if (this.y <= gameInstance.map.offsetY) {
				this.y = gameInstance.map.offsetY;
				this.hit = true;
			}
		} else if (this.dir == DOWN) {
			if (this.y >= gameInstance.map.offsetY + gameInstance.map.mapHeight - this.size) {
				this.y = gameInstance.map.offsetY + gameInstance.map.mapHeight - this.size;
				this.hit = true;
			}
		}
		if (!this.hit) {
			//地图检测
			if (tankMapCollision(this, gameInstance)) {
				this.hit = true;
			}
		}
		//坦克检测
		/*if(enemyArray != null && enemyArray.length >0){
			var enemySize = enemyArray.length;
			for(var i=0;i<enemySize;i++){
				if(enemyArray[i] != this && CheckIntersect(enemyArray[i],this,0)){
					this.hit = true;
					break;
				}
			}
		}*/
	};
};

/**
 * 菜单选择坦克
 * ..returns
 */
const SelectTank = function () {
	this.ys = [250, 281];//两个Y坐标，分别对应1p和2p
	this.x = 140;
	this.size = 27;
};

SelectTank.prototype = new Tank();

/**
 * 玩家坦克
 * ..param context 画坦克的画布
 * ..returns
 */

var PlayTank = function () {
	this.lives = 3;//生命值
	this.isProtected = true;//是否受保护
	this.protectedTime = 500;//保护时间
	this.offsetX = 0;//坦克2与坦克1的距离
	this.speed = 2;//坦克的速度
	this.distroy = function (gameInstance, tankIndex) {
		this.isDestroyed = true;
		const crackType = CRACK_TYPE.CRACK_TYPE_TANK
		gameInstance.crackArray.push(new CrackAnimation(crackType, this));
		//客户端同步添加爆炸动画Obj
		ServerSendMsg(
			ws,
			MSG_TYPE_SERVER.MSG_SYNC_SERVER,
			new SyncMsg('add_crack_player', SYNC_SERVER_TYPE.CRACK_ADD, { crackType, tankType: this.type, tankIndex })
		);
		//客户端播放坦克销毁音频
		controlAudioPlay(ws, 'playerdestroy_audio', OPERA_AUDIO_TYPE.AUDIO_PLAYER_DESTORY, OPERA_AUDIO_TYPE.AUDIO_PLAY)
	};

	this.renascenc = function (player, gameInstance) {
		this.lives--;
		this.dir = UP;
		this.isProtected = true;
		this.protectedTime = 500;
		this.isDestroyed = false;
		var temp = 0;
		if (player == 1) {
			temp = 129;
		} else {
			temp = 256;
		}
		this.x = temp + gameInstance.map.offsetX;
		this.y = 385 + gameInstance.map.offsetY;
	};

};
PlayTank.prototype = new Tank();

/**
 * 敌方坦克1
 * ..param context 画坦克的画布
 * ..returns
 */
var EnemyOne = function () {
	this.isAppear = false;
	this.times = 0;
	this.lives = 1;
	this.isAI = true;
	this.speed = 1.5;
	this.aiTankType = -1;

	this.draw = function (ws, gameInstance, tankIndex) {
		this.times++;
		const { x, y, dir, aiTankType } = this;
		if (!this.isAppear) {//出现之前绘制
			let temp = parseInt(this.times / 5) % 7;
			ServerSendMsg(
				ws,
				MSG_TYPE_SERVER.MSG_OPERA_DRAW,
				new DrawMsg('tankbefore_draw', OPERA_DRAW_TYPE.TANKBEFORE_DRAW, { tankIndex, temp, x, y })
			);
			if (this.times == 35) {
				this.isAppear = true;
				this.times = 0;
				//params(ws, gameInstance, tankIndex, type)//2标识为ai
				this.shoot(ws, gameInstance, tankIndex, 2);
			}
		} else {//isAppear出现之后绘制
			ServerSendMsg(
				ws,
				MSG_TYPE_SERVER.MSG_OPERA_DRAW,
				new DrawMsg('tankafter_draw', OPERA_DRAW_TYPE.TANKAFTER_DRAW, { tankIndex, x, y, dir, aiTankType })
			);
			//以一定的概率射击
			if (this.times % 50 == 0) {
				let ra = Math.random();
				if (ra < this.shootRate) {
					this.shoot(ws, gameInstance, tankIndex, 2);
				}
				this.times = 0;
			}
			// this.move(this.gameCtx);
		}
	};
};
EnemyOne.prototype = new Tank();


/**
 * 敌方坦克2
 * ..param context 画坦克的画布
 * ..returns
 */
var EnemyTwo = function () {
	this.isAppear = false;
	this.times = 0;
	this.lives = 2;
	this.isAI = true;
	this.speed = 1;
	this.aiTankType = -1;
	this.draw = function (ws, gameInstance, tankIndex) {
		this.times++;
		const { x, y, dir, aiTankType } = this;
		if (!this.isAppear) {//出现之前绘制
			let temp = parseInt(this.times / 5) % 7;
			ServerSendMsg(
				ws,
				MSG_TYPE_SERVER.MSG_OPERA_DRAW,
				new DrawMsg('tankbefore_draw', OPERA_DRAW_TYPE.TANKBEFORE_DRAW, { tankIndex, temp, x, y })
			);
			if (this.times == 35) {
				this.isAppear = true;
				this.times = 0;
				//params(ws, gameInstance, tankIndex, type)//2标识为ai
				this.shoot(ws, gameInstance, tankIndex, 2);
			}
		} else {//isAppear出现之后绘制
			ServerSendMsg(
				ws,
				MSG_TYPE_SERVER.MSG_OPERA_DRAW,
				new DrawMsg('tankafter_draw', OPERA_DRAW_TYPE.TANKAFTER_DRAW, { tankIndex, x, y, dir, aiTankType })
			);
			//以一定的概率射击
			if (this.times % 50 == 0) {
				let ra = Math.random();
				if (ra < this.shootRate) {
					this.shoot(ws, gameInstance, tankIndex, 2);
				}
				this.times = 0;
			}
			// this.move(this.gameCtx);
		}
	};
};
EnemyTwo.prototype = new Tank();



/**
 * 敌方坦克3
 * ..param context 画坦克的画布
 * ..returns
 */
var EnemyThree = function () {
	this.isAppear = false;
	this.times = 0;
	this.lives = 3;
	this.isAI = true;
	this.speed = 0.5;
	this.aiTankType = -1;
	this.draw = function (ws, gameInstance, tankIndex) {
		this.times++;
		const { x, y, dir, aiTankType } = this;
		if (!this.isAppear) {//出现之前绘制
			let temp = parseInt(this.times / 5) % 7;
			ServerSendMsg(
				ws,
				MSG_TYPE_SERVER.MSG_OPERA_DRAW,
				new DrawMsg('tankbefore_draw', OPERA_DRAW_TYPE.TANKBEFORE_DRAW, { tankIndex, temp, x, y })
			);
			if (this.times == 35) {
				this.isAppear = true;
				this.times = 0;
				//params(ws, gameInstance, tankIndex, type)//2标识为ai
				this.shoot(ws, gameInstance, tankIndex, 2);
			}
		} else {//isAppear出现之后绘制
			ServerSendMsg(
				ws,
				MSG_TYPE_SERVER.MSG_OPERA_DRAW,
				new DrawMsg('tankafter_draw', OPERA_DRAW_TYPE.TANKAFTER_DRAW, { tankIndex, x, y, dir, aiTankType })
			);
			//以一定的概率射击
			if (this.times % 50 == 0) {
				let ra = Math.random();
				if (ra < this.shootRate) {
					this.shoot(ws, gameInstance, tankIndex, 2);
				}
				this.times = 0;
			}
			// this.move(this.gameCtx);
		}
	};
};
EnemyThree.prototype = new Tank();

module.exports = {
	Tank,
	SelectTank,
	PlayTank,
	EnemyOne,
	EnemyTwo,
	EnemyThree
}





