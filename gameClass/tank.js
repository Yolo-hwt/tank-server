//全局变量引入
const { DIRECT, CRACK_TYPE } = require("../hook/globalParams");
const { UP, DOWN, LEFT, RIGHT } = DIRECT;
//工具函数引入
const { tankMapCollision } = require("../utils/Collision")
//外部类引入
const { Bullet } = require("../gameClass/bullet")
//socketMessage变量引入
const {
	MSG_TYPE_SERVER,
	SYNC_SERVER_TYPE,
	OPERA_AUDIO_TYPE,
	SyncMsg,
	ServerSendMsg
} = require("../socket/socketMessage")
//
const {
	controlAudioPlay
} = require("../hook/controlClientLogic")
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
	this.shootNum = 0;
	this.maxShootNum = 3;
	this.bullet = null;//子弹
	this.shootRate = 0.6;//射击的概率
	this.isDestroyed = false;
	this.tempX = 0;
	this.tempY = 0;

	this.shoot = function (ws, gameInstance, tankIndex, type) {
		if (this.isAI && gameInstance.emenyStopTime > 0) {
			return;
		}
		if ((this.isAI && this.isShooting) || (!this.isAI && this.shootNum >= this.maxShootNum)) {
			//ai且正在射击 || player且达到最大子弹数量
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
			let refers = { tankIndex, type, dir: this.dir, tempX, tempY };
			ServerSendMsg(
				ws,
				MSG_TYPE_SERVER.MSG_SYNC_SERVER,
				new SyncMsg('bullet_create', SYNC_SERVER_TYPE.BULLET_ADD, refers)
			);
			if (!this.isAI) {
				//通知客户端play 玩家子弹攻击音效
				//ATTACK_AUDIO.play();
				controlAudioPlay(ws, 'attack_audio', OPERA_AUDIO_TYPE.AUDIO_ATTACK, OPERA_AUDIO_TYPE.AUDIO_PLAY);
			}
			//将子弹加入子弹数组中
			gameInstance.bulletArray.push(this.bullet);
			//交给gameloop循环中同一控制子弹绘制移动参数变化
			//this.bullet.draw(ws, gameInstance, gameInstance.bulletArray.length - 1);

			this.isShooting = true;
			if (!this.isAI) {
				this.shootNum++;
			}
		}
	}
	/**
	  * 坦克被击毁
	  */
	//type；1玩家 2ai坦克
	//tankIndex:1-1/2玩家1或2 2-nai坦克index
	this.distroy = function (ws, gameInstance, type, tankIndex) {
		this.isDestroyed = true;
		if (type == 1) {
			this.renascenc(tankIndex, gameInstance);
			//同步客户端player状态
			ServerSendMsg(
				ws,
				MSG_TYPE_SERVER.MSG_SYNC_SERVER,
				new SyncMsg('player_renascenc', SYNC_SERVER_TYPE.PLAYER_RENASCENC, { tankIndex })
			);
		}
		const crackType = CRACK_TYPE.CRACK_TYPE_TANK
		// gameInstance.crackArray.push(new CrackAnimation(crackType, this));
		//客户端同步添加爆炸动画Obj
		ServerSendMsg(
			ws,
			MSG_TYPE_SERVER.MSG_SYNC_SERVER,
			new SyncMsg('add_crack_tank', SYNC_SERVER_TYPE.CRACK_ADD, { crackType, tankType: type, tankIndex })
		);
		//TANK_DESTROY_AUDIO.play();
		//客户端播放坦克销毁音频
		let audioType = OPERA_AUDIO_TYPE.AUDIO_TANK_DESTROY
		if (type == 1) {
			audioType = OPERA_AUDIO_TYPE.AUDIO_PLAYER_DESTORY
		}
		controlAudioPlay(ws, 'tankdestroy_audio', audioType, OPERA_AUDIO_TYPE.AUDIO_PLAY)
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
	this.speed = 5;//坦克的速度

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
		if (this.isAppear) {//isAppear出现之后绘制
			this.times++;
			// 以一定的概率射击
			if (this.times % 50 == 0) {
				let ra = Math.random();
				if (ra < this.shootRate) {
					this.shoot(ws, gameInstance, tankIndex, 2);
				}
				this.times = 0;
			}
			this.move(gameInstance);
			//同步客户端坦克位置
			//将移动后坦克位置数据同步客户端
			const { dir, x, y, lives } = this;
			ServerSendMsg(
				ws,
				MSG_TYPE_SERVER.MSG_SYNC_SERVER,
				new SyncMsg(
					'aitank_move',
					SYNC_SERVER_TYPE.AITANK_MOVE,
					{ index: tankIndex, dir, x, y, lives }
				)
			);
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
		if (this.isAppear) {//isAppear出现之后绘制
			this.times++;
			// 以一定的概率射击
			if (this.times % 50 == 0) {
				let ra = Math.random();
				if (ra < this.shootRate) {
					this.shoot(ws, gameInstance, tankIndex, 2);
				}
				this.times = 0;
			}
			this.move(gameInstance);
			//同步客户端坦克位置
			//将移动后坦克位置数据同步客户端
			const { dir, x, y, lives } = this;
			ServerSendMsg(
				ws,
				MSG_TYPE_SERVER.MSG_SYNC_SERVER,
				new SyncMsg(
					'aitank_move',
					SYNC_SERVER_TYPE.AITANK_MOVE,
					{ index: tankIndex, dir, x, y, lives }
				)
			);
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
		if (this.isAppear) {//isAppear出现之后绘制
			this.times++;
			// 以一定的概率射击
			if (this.times % 50 == 0) {
				let ra = Math.random();
				if (ra < this.shootRate) {
					this.shoot(ws, gameInstance, tankIndex, 2);
				}
				this.times = 0;
			}
			this.move(gameInstance);
			//同步客户端坦克位置
			//将移动后坦克位置数据同步客户端
			const { dir, x, y, lives } = this;
			ServerSendMsg(
				ws,
				MSG_TYPE_SERVER.MSG_SYNC_SERVER,
				new SyncMsg(
					'aitank_move',
					SYNC_SERVER_TYPE.AITANK_MOVE,
					{ index: tankIndex, dir, x, y, lives }
				)
			);
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





