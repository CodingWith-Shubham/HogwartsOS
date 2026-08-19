export const sanitizeUser = (user) => {
    if (!user) return null;
    return {
        id: user.empId || user._id.toString(),
        _id: user._id,
        empId: user.empId,
        name: user.name || user.fullName || user.username,
        email: user.email,
        phone: user.phone || "",
        designation: user.designation || "",
        role: user.role || "sales",
        initials: user.initials || (user.name ? user.name.split(" ").map(n => n[0]).join("").toUpperCase() : "U"),
        username: user.username,
        redirectTo: user.redirectTo || (user.role === 'manager' ? '/manager' : user.role === 'sales' ? '/sales' : user.role === 'editor' ? '/editor' : '/shoot'),
        avatar: user.avatar || "https://placehold.co/200x200",
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        isActive: user.isActive,
    };
};