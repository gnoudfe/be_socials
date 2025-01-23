const jwt = require("jsonwebtoken");

/**
 * Middleware xác thực người dùng dựa trên JWT token.
 */
const authenticatedUser = async (req, res, next) => {
  let accessToken = req.cookies?.accessToken;
  const refreshToken = req.cookies?.refreshToken;

  // Kiểm tra nếu cả accessToken và refreshToken đều không có
  if (!accessToken && !refreshToken) {
    return res.status(401).json({
      success: false,
      message: "Please log in to continue.",
    });
  }

  // Hàm tạo accessToken mới
  const generateNewAccessToken = (refreshToken) => {
    try {
      const decodedRefresh = jwt.verify(
        refreshToken,
        process.env.JWT_REFRESH_SECRET_KEY
      );
      return jwt.sign(
        { userId: decodedRefresh.userId },
        process.env.JWT_ACCESS_SECRET_KEY,
        { expiresIn: "25s" }
      );
    } catch (error) {
      throw new Error("Invalid or expired refresh token");
    }
  };

  try {
    // Xác thực accessToken
    jwt.verify(
      accessToken,
      process.env.JWT_ACCESS_SECRET_KEY,
      (err, decoded) => {
        if (err) {
          if (
            err.name === "TokenExpiredError" ||
            err.name === "JsonWebTokenError"
          ) {
            try {
              accessToken = generateNewAccessToken(refreshToken);

              // Cập nhật lại accessToken trong cookie
              res.cookie("accessToken", accessToken, {
                httpOnly: true,
                // sameSite: "none",
                // secure: true,
                maxAge: 25 * 60 * 1000,
              });

              req.user = jwt.decode(accessToken); // Lưu thông tin người dùng
              return next();
            } catch (refreshError) {
              return res.status(401).json({
                success: false,
                message: "Refresh token expired, please log in again.",
              });
            }
          }

          // Nếu lỗi không phải do hết hạn token
          return res.status(401).json({
            success: false,
            message: "Invalid or expired token.",
          });
        }

        // Lưu thông tin người dùng khi accessToken hợp lệ
        req.user = decoded;
        next();
      }
    );
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: error.message || "Unauthorized access",
    });
  }
};

module.exports = authenticatedUser;
