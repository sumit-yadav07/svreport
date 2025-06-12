import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Package, Users, AlertTriangle, Download } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

interface VersionDetails {
  id: number;
  name: string;
  version: string;
  source: string;
  browser: string;
  generated_cpe: string;
  vulnerabilities: Array<{ cve: string; cvss_score: number; details_link: string }> | null;
}

export const VersionDetailsPage: React.FC = () => {
  const [version, setVersion] = useState<VersionDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const { id } = useParams<{ id: string }>();
  const { token } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (id) {
      fetchVersionDetails();
    }
  }, [id]);

  const fetchVersionDetails = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`/api/latest/fleet/software/versions/${id}`, {
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      setVersion(data.software);
    } catch (error) {
      console.error('Error fetching version details:', error);
      setError(error instanceof Error ? error.message : 'Failed to fetch version details');
    } finally {
      setIsLoading(false);
    }
  };

  const handleExport = () => {
    if (!version?.vulnerabilities) return;

    // Convert data to CSV format
    const headers = ['CVE ID', 'CVSS Score', 'Details Link'];
    const csvRows = [headers];

    // Handle both array and object formats of vulnerabilities
    const vulnerabilities = Array.isArray(version.vulnerabilities) 
      ? version.vulnerabilities 
      : [version.vulnerabilities];

    vulnerabilities.forEach((vuln) => {
      if (vuln) {  // Check if vuln exists
        csvRows.push([
          vuln.cve || 'N/A',
          vuln.cvss_score?.toString() || 'N/A',
          vuln.details_link || 'N/A'
        ]);
      }
    });

    // Convert to CSV string
    const csvContent = csvRows.map(row => row.map(cell => {
      // Escape quotes and wrap in quotes if contains comma or newline
      const escaped = cell.toString().replace(/"/g, '""');
      return cell.toString().includes(',') || cell.toString().includes('\n') 
        ? `"${escaped}"` 
        : escaped;
    }).join(',')).join('\n');

    // Create and trigger download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `version-${version.id}-vulnerabilities.csv`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-3 text-gray-600">Loading version details...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Error Loading Version</h3>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={fetchVersionDetails}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!version) {
    return (
      <div className="text-center py-12">
        <Package className="h-12 w-12 text-gray-400 mx-auto mb-4" />
        <p className="text-gray-500">Version not found</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center space-x-4">
        <button
          onClick={() => navigate(-1)}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors duration-200"
        >
          <ArrowLeft className="h-5 w-5 text-gray-600" />
        </button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold text-gray-900">{version.name}</h1>
          <p className="text-gray-600">Version {version.version}</p>
        </div>
      </div>

      {/* Summary Card */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="p-3 bg-blue-100 rounded-lg">
              <Package className="h-8 w-8 text-blue-600" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">{version.name}</h2>
              <p className="text-gray-600">Version {version.version}</p>
            </div>
          </div>
          {version.vulnerabilities && version.vulnerabilities.length > 0 && (
            <button
              onClick={handleExport}
              className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200"
            >
              <Download className="h-4 w-4 mr-2" />
              Export Vulnerabilities
            </button>
          )}
        </div>
      </div>

      {/* Vulnerabilities Section */}
      {version.vulnerabilities && version.vulnerabilities.length > 0 ? (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900">Vulnerabilities</h3>
            <p className="text-sm text-gray-600">Known vulnerabilities for this version</p>
          </div>
          <div className="divide-y divide-gray-200">
            {version.vulnerabilities.map((vuln, index) => (
              <div key={index} className="px-6 py-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                      <AlertTriangle className="h-3 w-3 mr-1" />
                      {vuln.cve}
                    </span>
                    <span className="text-sm text-gray-500">
                      CVSS Score: {vuln.cvss_score}
                    </span>
                  </div>
                  <a
                    href={vuln.details_link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-blue-600 hover:text-blue-800"
                  >
                    View Details
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 text-center">
          <Package className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-500">No vulnerabilities found for this version</p>
        </div>
      )}
    </div>
  );
}; 