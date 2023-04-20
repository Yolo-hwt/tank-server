//全局变量引入
const { STATE, GAME_MODE } = require("../hook/globalParams");
const { GAME_STATE_MENU } = STATE
const { LOCAL_GAME, ONLINE_GAME } = GAME_MODE;
class GameInstance {
    constructor(name) {
        //客户端名称
        this.clientName = name;
        //游戏模式
        this.gameMode = ONLINE_GAME;
        //本地游戏循环计时器id
        this.gameLoopId = null;
        this.ctx = {}; //2d画布
        this.wallCtx = {}; //地图画布
        this.grassCtx = {}; //草地画布
        this.tankCtx = {}; //坦克画布
        this.overCtx = {}; //结束画布
        //this.menu = null; //菜单
        //this.stage = null; //舞台
        this.map = null; //地图
        // this.player1 = null; //玩家1
        //this.player2 = null; //玩家2
        this.prop = null;
        this.enemyArray = []; //敌方坦克
        this.bulletArray = []; //子弹数组
        this.keys = []; //记录按下的按键
        this.crackArray = []; //爆炸数组
        this.gameState = GAME_STATE_MENU; //默认菜单状态
        this.level = 1; //默认关卡等级
        this.maxEnemy = 20; //敌方坦克总数
        this.maxAppearEnemy = 5; //屏幕上一起出现的最大数
        this.appearEnemy = 0; //已出现的敌方坦克
        this.mainframe = 0;
        this.isGameOver = false; //游戏结束标识
        this.overX = 176;
        this.overY = 384;
        this.emenyStopTime = 0; //敌方坦克停止时间
        this.homeProtectedTime = -1;
        this.propTime = 300;

        //游戏逻辑需要添加的与客户端不同的附加属性
        //实际以客户端为准，客户端将需要处理逻辑的数据发送到服务器
        //服务器处理后得到结果，再返回客户端，同时修改此处变量
        this.menu = {
            playNum: 1
        }
        this.player1 = {
            lives: 0
        }
        this.player2 = {
            lives: 0
        }
        this.stage = {
            isReady: false
        }
    }

}
module.exports = { GameInstance };