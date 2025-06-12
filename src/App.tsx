import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Layout } from './components/Layout';
import { LoginPage } from './pages/LoginPage';
import { HomePage } from './pages/HomePage';
import { HostDetailsPage } from './pages/HostDetailsPage';
import { SoftwareListPage } from './pages/SoftwareListPage';
import { SoftwareDetailsPage } from './pages/SoftwareDetailsPage';
import { OpenSourceSoftwarePage } from './pages/OpenSourceSoftwarePage';
import { VersionDetailsPage } from './pages/VersionDetailsPage';

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/" element={<Navigate to="/home" replace />} />
          <Route
            path="/*"
            element={
              <ProtectedRoute>
                <Layout>
                  <Routes>
                    <Route path="/home" element={<HomePage />} />
                    <Route path="/host/:id" element={<HostDetailsPage />} />
                    <Route path="/software" element={<SoftwareListPage />} />
                    <Route path="/software/open-source" element={<OpenSourceSoftwarePage />} />
                    <Route path="/software/:id" element={<SoftwareDetailsPage />} />
                    <Route path="/software/versions/:id" element={<VersionDetailsPage />} />
                  </Routes>
                </Layout>
              </ProtectedRoute>
            }
          />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;