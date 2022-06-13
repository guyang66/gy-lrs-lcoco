module.exports = app => ({
  /**
   *  校验电话号码格式
   */

  validatePhoneFormat (value) {
    if (value && value.length !== 11) {
      return false
    }
    //判断是否是11位数字
    let regexp = /^\d{11}$/
    if(!regexp.test(value)){
      return false
    }
    return  true
  },

  /**
   * 校验sms 验证码格式
   * @param value
   * @param length
   * @returns {boolean}
   */

  validateSmsCodeFormat (value, length) {

    // 开发环境跳过验证码校验
    if(process.env.NODE_ENV === 'development'){
      return  true
    }

    if (value && value.length !== length) {
      return false
    }
    let regexp = /^\d{6}$/
    if(!regexp.test(value)){
      return false
    }
    return  true
  },

  /**
   * 格式化Date YYMMDD hhmmss
   * @param t
   * @returns {string}
   */
  formatDate  (t) {
    if(!t){
      t = new Date()
    }

    if(!(t instanceof Date)){
      t = new Date(t)
    }
    let h = t.getHours()
    let m = t.getMinutes()
    let s = t.getSeconds()
    return this.formatDateYYMMDD(t) + ' ' + (h < 10 ? ('0' + h) : h) + ':' + (m < 10 ? ('0' + m) : m ) + ':' + (s < 10 ? ('0' + s) : s)
  },

  /**
   *  格式Date 返回格式：YYYY-MM-DD
   */

  formatDateYYMMDD (t) {
    if(!(t instanceof Date)){
      t = new Date(t)
    }
    let y = t.getFullYear()
    let m = t.getMonth() + 1
    let d = t.getDate()
    return '' + y + '-' + (m < 10 ? ('0' + m) : m) + '-' + (d < 10 ? ('0' + d) : d)
  },

  /**
   *  获取当前时间字符串
   */
  getTodayString  () {
    return this.formatDateYYMMDD(new Date())
  },
  /**
   *  获取两个时间戳的差值
   */
  getIntervalForGmt (t1, t2) {
    if(!t2){
      t2 = new Date().getTime() + 1000 * 60 * 60
    }
    if(!(t1 instanceof Date)){
      t1 = new Date(t1)
    }
    if(!(t2 instanceof Date)){
      t2 = new Date(t2)
    }
    return Math.abs(t1.getTime() - t2.getTime())
  },
  /**
   *
   * @param t1
   * @param t2
   * @param interval
   * @returns {boolean}
   */
  compareTimeOut (t1, t2, interval) {
    if(!t2){
      return false
    }
    return this.getIntervalForGmt(t1, t2) < interval
  },

  /**
   *  判断是否是对象
   */
  isEmptyObject  (object) {

    if(!object || typeof object !== 'object'){
      return  true
    }

    if (JSON.stringify(object) === '{}') {
      return true
    }

    return  Object.keys(object).length < 1
  },

})
