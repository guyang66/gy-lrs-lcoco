module.exports = app => ({


  /**
   * 更新
   * @param id
   * @param data
   * @param model
   * @returns {Promise<*|boolean>}
   */
  async update (id, data, model) {
    const { errorLogger } = app.$log4
    try {
      return await model.findByIdAndUpdate(id, data)
    } catch (e){
      errorLogger.error(e)
      // 在控制台打印错误信息，生产环境不打印
      console.log(e)
      return false
    }
  },

  /**
   * 新增
   * @param content
   * @param model
   * @returns {Promise<boolean>}
   */
  async save (content, model) {
    const { errorLogger } = app.$log4
    let newInstance = new model({...content})
    // save不立刻返回对象，需要用promise 去回调函数拿。
    let p = new Promise((resolve,reject)=>{
      newInstance.save(function(err, doc){
        if(err){
          reject(err)
        } else {
          resolve(doc)
        }
      })
    })
    try {
      return await p
    } catch (e){
      errorLogger.error('保存失败！' + e)
      console.log(e)
      return false
    }
  },

  /**
   * 删除
   * @param id
   * @param model
   * @returns {Promise<boolean>}
   */
  async delete (id, model) {
    const { errorLogger } = app.$log4
    if(!model){
      return false
    }
    try {
      await model.findByIdAndRemove(id)
      return true
    } catch (e){
      errorLogger.error('删除失败！' + e)
      console.log(e)
      return false
    }
  },

  /**
   * 条件查询list
   * @param model
   * @param params
   * @returns {Promise<boolean>}
   */
  async query (model, params, options) {
    const { $format } = app
    const { errorLogger } = app.$log4
    let queryParams = {}
    let queryOptions = {
      sort: {_id: -1}
    }
    if(!$format.isEmptyObject(params)){
      queryParams = {...queryParams, ...params}
    }
    if(!$format.isEmptyObject(options)){
      queryOptions = {...queryOptions, ...options}
    }

    try {
      return await model.find(queryParams, null, queryOptions)
    } catch (e){
      errorLogger.error(e)
      console.log(e)
      return false
    }
  },

  /**
   * id查询
   * @param model
   * @returns {Promise<boolean>}
   */
  async queryById (id, model) {
    const { errorLogger } = app.$log4
    try {
      return await model.findById(id)
    } catch (e){
      errorLogger.error(e)
      console.log(e)
      return false
    }
  },

  /**
   * 条件查询一个
   * @param model
   * @param params
   * @returns {Promise<*|boolean>}
   */
  async findOne (model, params) {
    const { $format } = app
    const { errorLogger } = app.$log4
    let queryParams = {}
    if(!$format.isEmptyObject(params)){
      queryParams = {...queryParams, ...params}
    }
    try {
      return await model.findOne(queryParams)
    } catch (e) {
      errorLogger.error(e)
      console.log(e)
      return false
    }
  }

})
