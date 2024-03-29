/**
 * 封装koa, mvc框架。 后面可扩展, 一个应用程序可以绑定多个koa实例
 */

const path = require('path')
const Koa = require('koa')
const chalk = require('chalk')

const {
  initConfig,
  initController,
  initRouter,
  initWs,
  initService,
  initLog4,
  initExtend,
  initMiddleware,
  initConstants,
  initErrorCode,
  initNodeCache,
  initMongodb,
  initMongoModel,
  initSchedule,
} = require('./loader')

class Application {
  constructor() {
    this.$app = new Koa();

    // 初始化config
    this.$config = initConfig(this);

    // 初始化静态变量
    this.$constants = initConstants()
    this.$errorCode = initErrorCode()

    // 缓存对象挂到app上
    this.$nodeCache = initNodeCache(this);

    // 挂载中间件实例
    this.$middleware = initMiddleware(this);
    console.log("========= middleware ==========")
    // console.log(this.$middleware)

    // 初始化最开始需要被加载的中间件
    this.beforeAll(this)

    // 初始化通用设置
    this.initSettings(this)

    //初始化中间件
    this.initDefaultMiddleware()

    // 初始化日志系统
    this.$log4 = initLog4(this)

    // 初始化mongodb model
    this.$model = initMongoModel(this);
    console.log("========= mongodb models ==========")
    console.log(this.$model)

    // 初始化数据库
    initMongodb(this);

    // 初始化extend类
    initExtend(this)
    console.log("========= extends-helper ==========")
    // console.log(this.$helper)
    // 初始化service
    this.$service = initService(this);

    console.log("========= service ==========")
    // console.log(this.$service)

    // 初始化controller
    this.$controller = initController(this);

    console.log("========= controllers ==========")
    // console.log(this.$controller)

    // 初始化路router
    this.$router = initRouter(this);

    // 初始化websocket

    this.$ws = initWs(this)

    // timer表，每个game维护独自的定时器timer，互不影响
    this.$timer = {}

    // 将ctx注入到app上
    this.$app.use(async (ctx, next) => {
      //todo: bug！！！ 返回值错乱。
      // 因为中间件设置了ctx，两次请求进来先设置ctx，因为几乎是同一时间，导致第二次直接覆盖了第一次的值，所以2次请求走到下一个中间件的处理均使用了第二次的ctx值，造出返回值错乱
      // 解决方案：1、controller使用args中的ctx，调用service的时候传递把ctx传递给service
      // 解放方案：2、使用eggjs的思路，controller和service抽象到class中，controller是中间件方法，可以直接初始化，service则需要懒加载（被调用的时候再初始化ctx，保证ctx是当前调用者上下文）
      this.ctx = ctx;
      await next()
    })
    this.$app.use(this.$router.routes());

    if(process.env.NODE_ENV === 'product'){
      process.on('uncaughtException',function (err){
        const { errorLogger } = this.$log4
        errorLogger.error('=============【全局异常捕获】=============')
        errorLogger.error(err)
      })
    }

    this.afterAll(this)
  }

  initSettings (app) {
    // 重写console 生产环境控制台不输出信息
    console.log = (function (ori){
      return function (){
        if(process.env.NODE_ENV !== 'production'){
          ori.apply(this,arguments)
        }
      }
    })(console.log);
  }

  /**
   * 初始化koa常用中间件
   */
  initDefaultMiddleware () {
    const json = require('koa-json');
    const onerror = require('koa-onerror');
    const koaStatic = require('koa-static');
    const koaBody = require('koa-body');
    const cors = require('koa2-cors');
    const views = require('koa-views');

    // 日志打点 最顶层中间件
    if(process.env.NODE_ENV === 'development'){
      // this.$app.use(logger())
    }

    // 静态资源 - 1天的缓存
    let opts = process.env.NODE_ENV === 'production' ? { maxage: 24 * 60 * 60  * 1000} : {}
    this.$app.use(koaStatic(path.resolve(__dirname, '../public'), opts))

    // body接口数据处理(用koa-body 替代koa-bodyparser和koa-multer，前者处理post的参数为json格式，后者为文件上传相关)
    this.$app.use(koaBody({
      multipart: true,
      // encoding: 'gzip',
      formidable: {
        maxFileSize: 3000 * 1024 * 1024    // 设置上传文件大小最大限制，默认30M
      }
    }));

    // 跨域处理
    this.$app.use(cors());

    // json格式化response数据
    this.$app.use(json())

    // error处理
    onerror(this.$app)

    // ejs模板引擎
    this.$app.use(views(path.resolve(__dirname, '../views'), {
      extension: 'ejs',
      async: true
    }))

    // 公共数据
  }

  /**
   * 初始化需要最开始加载的自定义中间件
   * @param app
   */
  beforeAll (app){
    // 初始化page config
    app.$app.use(app.$middleware.cache)
  }

  /**
   * 初始化需要最后加载的自定义中间件
   * @param app
   */
  afterAll (app) {
    // 启动定时任务
    this.$schedule = initSchedule(app)
    // console.log(this.$scheduler)
  }

  /**
   * 应用start
   * @param port
   */
  start(port){
    let server = this.$app.listen(port, ()=>{
      console.log(chalk.green('server start on ' + port + '..........'))
    });
    // server.timeout = 1000 * 60 * 5
  }

}

module.exports = Application
