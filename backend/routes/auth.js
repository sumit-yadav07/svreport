import express from 'express';

const router = express.Router();

// Mock authentication endpoint
router.post('/v1/fleet/login', async (req, res) => {
  const { email, password } = req.body;

  // Mock authentication logic
  if (email && password) {
    // In a real app, you'd validate against a database
    const mockUser = {
      id: 1,
      name: "Jane Doe",
      email: email,
      global_role: "admin" // Can be "admin", "maintainer", or "observer"
    };

    const mockToken = `mock_token_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    res.json({
      user: mockUser,
      token: mockToken
    });
  } else {
    res.status(401).json({
      error: "Invalid credentials"
    });
  }
});

export { router as authRoutes };