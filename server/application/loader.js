const path = require('path')
const fs = require('fs')
const Router = require('koa-router');
const {errorLogger, commonLogger} = require('../../common/log4')
//自动扫指定目录下面的文件并且加载
const chalk = require('chalk');

function getFileStat(path) {
  try {
    fs.statSync(path);
    return true;
  } catch (err) {
    return false;
  }
}

function scanFilesByFolder(dir, cb) {
  let _folder = path.resolve(__dirname, dir);
  if(!getFileStat(_folder)){
    return;
  }
  try {
    const files = fs.readdirSync(_folder);
    files.forEach((file) => {

      if(file.match(/.DS/)){
        return;
      }

      if(file.match(/._v/)){
        return;
      }

      if(file.match(/._/)){
        return;
      }

      // 递归搜索
      let fullPath = path.join(dir, file);
      const stat = fs.statSync(path.join(__dirname,fullPath));
      if(stat.isDirectory()){
        scanFilesByFolder(path.join(dir,file),cb)
      }

      if(!file.match(/js/)){
        return;
      }

      let filename = file.replace('.js', '');
      let oFileCnt = require(_folder + '/' + filename);
      (typeof oFileCnt === 'function') && cb && cb(filename, oFileCnt);
    })

  } catch (error) {
    errorLogger.error('文件自动加载失败...', error)
    console.log('文件自动加载失败...', error);
  }
}

const initConfig = function () {
  let config = {};
  const projectConfig = require('../../config.json')
  config = {...config, ...projectConfig};
  return config;
}

const initConstants = function () {
  return require('../../common/constants')
}

const initErrorCode = function () {
  return require('../../common/errorCode')
}

const initController = function(app){
  let controllers = {};
  scanFilesByFolder('../controller',(filename, controller)=>{
    controllers[filename] = controller(app);
  })
  return controllers;
}

// 初始化路由
const initRouter = function(app){
  const router = new Router();
  require('../routes')({...app, router});
  return router;
}


function initService(app){
  let services = {};
  scanFilesByFolder('../service',(filename, service)=>{
    services[filename] = service(app);
  })
  return services;
}

// 初始化model
function initMongoModel(app){
  let model = {};
  const mongoose = require('mongoose')
  const BaseModel = require('../mongoModel/baseModel')
  scanFilesByFolder('../mongoModel',(filename, modelConfig)=>{
    model[filename] = modelConfig({...app, mongoose, BaseModel});
  });
  return model
}


// 初始化扩展
function initExtend(app) {
  scanFilesByFolder('../extend',(filename, extendFn)=>{
    app['$' + filename] = Object.assign(app['$' + filename] || {}, extendFn(app))
  })
}

function initMongodb(app) {
  const { commonLogger, mongoDBLogger } = app.$log4
  const utils = require('../extend/utils')
  const { localStringify } = utils(app)
  const mongoose = require('mongoose').set('debug', function (collectionName, method, query, doc) {
    let str = collectionName + '.' + method + '(' + localStringify(query) + ',' + localStringify(doc) + ')'
    // 开启sql log
    mongoDBLogger.info(str)
  });
  const options = {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    useFindAndModify: false
  }
  const config = app.$config
  let dbConfig = config.mongodb.local
  if(process.env.DB_ENV === 'development'){
    dbConfig = config.mongodb.dev
  }
  if(process.env.NODE_ENV === 'production'){
    dbConfig = config.mongodb.prd
  }
  const uri = 'mongodb://' + `${dbConfig.user}` + ':' + `${encodeURIComponent(dbConfig.pass)}` + '@' + `${dbConfig.servername}`  + ':' + `${dbConfig.port}` + '/' + `${dbConfig.database}`
  let url = uri + '?gssapiServiceName=mongodb'
  console.log(chalk.cyan('【mongodb url】：' + url));
  mongoose.connect(url,options,function (){})
  let db = mongoose.connection

  db.on('error', (error)=>{
    commonLogger.error('数据库连接失败！' + error)
    errorLogger.error('数据库连接失败！' + error)
    console.log(chalk.red('数据库连接失败！' + error));
  });
  db.once('open', ()=> {
    commonLogger.info("mongoDB connect success");
    console.log(chalk.green('============== mongoDB connect success ================='));
  })
  app.$mongoose = mongoose
  app.$db = db
}

// 初始化中间件middleware
function initMiddleware(app){
  let middleware = {}
  scanFilesByFolder('../middleware',(filename, middlewareConf)=>{
    middleware[filename] = middlewareConf(app);
  })
  return middleware;
}

function initLog4(app) {
  return require('../../common/log4');
}

function initNodeCache () {
  const NodeCache = require('node-cache')
  return new NodeCache()
}

function initSchedule (app) {
  const schedule = require('node-schedule');
  const { commonLogger } = app.$log4
  let schedules = {}
  scanFilesByFolder('../schedule',(filename, scheduler)=>{
    if(scheduler(app).open){
      schedules[filename] = schedule.scheduleJob(scheduler(app).interval,scheduler(app).handler)
      commonLogger.info('定时器：' + filename, '已启动')
    } else {
      commonLogger.info('定时器：' + filename, '设置为不启动！')
    }
  })
  return schedules;
}

module.exports = {
  initController,
  initRouter,
  initMiddleware,
  initService,
  initConfig,
  initLog4,
  initNodeCache,
  initExtend,
  initMongoModel,
  initMongodb,
  initSchedule,
  initConstants,
  initErrorCode,
}
