const n8nAuth = (req, res, next) => {
  const secret = req.headers['Krishan@199123'];
  if (!secret || secret !== process.env.N8N_SECRET) {
    return res.status(401).json({ 
      success: false,
      message: 'Unauthorized - Invalid or missing n8n secret' 
    });
  }
  next();
};

export { n8nAuth };
