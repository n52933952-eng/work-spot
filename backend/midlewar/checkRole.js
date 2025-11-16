// Middleware to check user role
export const checkRole = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: 'غير مصرح، يرجى تسجيل الدخول' });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ 
        message: 'غير مصرح لك بالوصول إلى هذا المورد' 
      });
    }

    next();
  };
};













