const baseModel = require('./baseModel')
module.exports = app => {
  const { mongoose } = app;
  const Vote = new mongoose.Schema(
    Object.assign({}, baseModel, {
      roomId: { type: String, required: [true,'roomId不能为空！']},
      gameId: { type: String, required: [true,'gameId不能为空！']},
      day: {type: Number, default: 1, required: [true,'主体不能为空！']  },
      stage: { type: Number, default: 0, required: [true,'主体不能为空！'] },
      from: { type: String, required: [true,'主体不能为空！']},
      to: { type: String, required: [true,'客体不能为空！']},

      remark: { type: String },
    }), {
      timestamps: { createdAt: 'createTime', updatedAt: 'modifyTime'},
      collection: "lcoco_vote",
    }
  )
  return mongoose.model('lcoco_vote', Vote);
}

