const { isUserBanned } = require("../data/db");

function banMiddleware() {
  return async (ctx, next) => {
    const userId = ctx.from?.id;
    if (userId && (await isUserBanned(userId))) {
      if (ctx.message) {
        await ctx.reply(
          "🚫 Tài khoản của bạn đã bị khóa do hủy đơn quá nhiều lần.\n" +
            "Vui lòng liên hệ quản trị viên để được hỗ trợ.",
        );
      }
      return;
    }
    return next();
  };
}

module.exports = { banMiddleware };
