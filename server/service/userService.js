// 设置投影，隐藏密码
let selectUserKey = { password: 0 };
module.exports = app => ({
  /**
   * 根据用户名查找用户
   * @param username
   * @returns {Promise<void>}
   */
  async getUsersByUsername(username){
    const { $model } = app;
    const { user } = $model
    if (username.length === 0) {
      return null;
    }
    const query = {username: username, status: 1};
    return await user.findOne(query, selectUserKey).exec();
  },
  /**
   * 根据用户名查找password
   * @param username
   * @returns {Promise<void>}
   */
  async getUsersPasswordByUsername(username) {
    const { $model } = app;
    const { user } = $model;
    if (username.length === 0) {
      return null;
    }
    const query = {username: {$in: username}};
    return await user.findOne(query).select('password').exec();
  },

  /**
   * 获取用户信息
   * @param id
   * @returns {Promise<*>}
   */
  async getUserInfoById(id) {
    const { $model } = app;
    const { user } = $model;
    let r = await user.findById(id, {}, function (err){
      if(err){
        console.log(err)
      }
    })
    return r
  },

  async getList (page = 1, pageSize = 10, params) {
    const { errorLogger } = app.$log4
    const { user } = app.$model
    let { searchKey, status } = params
    status = status - 0
    let list = []
    let searchParams = {}
    let sortParam = {
      _id: -1
    }

    if(searchKey && searchKey !== ''){
      let p1 = {}
      let p2 = {
        "$or": [
          {
            "username":new RegExp(searchKey,'i')
          },
          {
            "name":new RegExp(searchKey,'i')
          }
        ]
      }
      if(status !== undefined && status !== null && status !== 2){
        p1.status = status
      }
      searchParams = {
        "$and": [p1, p2]
      }
    } else {
      if(status !== undefined && status !== null && status !== 2){
        searchParams.status = status
      }
    }

    let total = await user.find(searchParams).countDocuments()
    list = await user.find(searchParams, null, {skip: pageSize * (page < 1 ? 0 : (page - 1)), limit: (pageSize - 0), sort: sortParam }, function (err){
      if(err){
        errorLogger.error(err)
      }
    })
    return { list, total }
  },
  /**
   * 超级管理员创建一个用户
   * @param username
   * @param password
   * @returns {Promise<*>}
   */
  async createUser (username, password) {
    const { user } = app.$model
    await user.create(
      {
        username: username,
        password: password,
        email: '',
        name: '默认姓名',
        roles: ['guest'],
        defaultRole: 'guest',
        defaultRoleName: '游客',
        status: 1
      }
    )
    const query = {username: {$in: username}};
    return await user.findOne(query, selectUserKey).exec();
  }
})
