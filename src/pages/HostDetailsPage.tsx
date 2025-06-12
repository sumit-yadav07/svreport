import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Monitor, Package, Settings, Calendar, HardDrive, Cpu, MemoryStick, AlertCircle, Download } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

interface HostDetails {
  id: number;
  display_name: string;
  hostname: string;
  uuid: string;
  os_version: string;
  uptime: number;
  memory: number;
  cpu_brand: string;
  last_restarted_at: string;
  detail_updated_at: string;
  status: string;
  primary_ip: string;
  gigs_disk_space_available: number;
}

interface InstalledVersion {
  version: string;
  last_opened_at: string | null;
  vulnerabilities: string[];
  installed_paths: string[];
}

interface Software {
  id: number;
  name: string;
  source: string;
  status: string | null;
  installed_versions: InstalledVersion[];
  software_package: any | null;
  app_store_app: any | null;
}

interface PaginationParams {
  page: number;
  per_page: number;
  order_key: string;
  order_direction: 'asc' | 'desc';
  vulnerable?: boolean;
}

export const HostDetailsPage: React.FC = () => {
  const [host, setHost] = useState<HostDetails | null>(null);
  const [software, setSoftware] = useState<Software[]>([]);
  const [activeTab, setActiveTab] = useState<'details' | 'software' | 'properties'>('details');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState(0);
  const [paginationParams, setPaginationParams] = useState<PaginationParams>({
    page: 0,
    per_page: 20,
    order_key: 'name',
    order_direction: 'asc',
    vulnerable: false
  });
  
  const { id } = useParams<{ id: string }>();
  const { token } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (id) {
      fetchHostDetails();
      if (activeTab === 'software') {
        fetchHostSoftware();
      }
    }
  }, [id, activeTab, paginationParams]);

  const fetchHostDetails = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`/api/latest/fleet/hosts/${id}?exclude_software=true`, {
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      setHost(data.host);
    } catch (error) {
      console.error('Error fetching host details:', error);
      setError(error instanceof Error ? error.message : 'Failed to fetch host details');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchHostSoftware = async (exportAll: boolean = false) => {
    try {
      const params = new URLSearchParams();
      
      // Always include filters
      params.append('order_key', paginationParams.order_key);
      params.append('order_direction', paginationParams.order_direction);
      if (paginationParams.vulnerable !== undefined) {
        params.append('vulnerable', paginationParams.vulnerable.toString());
      }

      // Only include pagination params if not exporting
      if (!exportAll) {
        params.append('page', paginationParams.page.toString());
        params.append('per_page', paginationParams.per_page.toString());
      }

      const response = await fetch(`/api/latest/fleet/hosts/${id}/software?${params.toString()}`, {
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      
      if (response.ok) {
        const data = await response.json();
        setSoftware(data.software || []);
        setTotalCount(data.count || 0);

        // If this is an export request, trigger the download
        if (exportAll) {
          // Convert data to CSV format
          const headers = ['Name', 'Version', 'Source', 'Vulnerability Count'];
          const csvRows = [headers];

          data.software.forEach((item: Software) => {
            const version = item.installed_versions?.[0]?.version || 'N/A';
            const vulnerabilityCount = item.installed_versions?.[0]?.vulnerabilities?.length || 0;
            csvRows.push([
              item.name,
              version,
              item.source,
              vulnerabilityCount.toString()
            ]);
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
          a.download = `host-${id}-software-export.csv`;
          document.body.appendChild(a);
          a.click();
          window.URL.revokeObjectURL(url);
          document.body.removeChild(a);
        }
      }
    } catch (error) {
      console.error('Error fetching host software:', error);
    }
  };

  const handleExport = () => {
    fetchHostSoftware(true);
  };

  const handlePageChange = (newPage: number) => {
    setPaginationParams(prev => ({ ...prev, page: newPage }));
  };

  const handleSort = (key: string) => {
    setPaginationParams(prev => ({
      ...prev,
      order_key: key,
      order_direction: prev.order_key === key && prev.order_direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const handleVulnerableFilter = (value: boolean) => {
    setPaginationParams(prev => ({ ...prev, vulnerable: value, page: 0 }));
  };

  const formatUptime = (seconds: number) => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    return `${days}d ${hours}h`;
  };

  const formatMemory = (bytes: number) => {
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return 'Never';
    try {
      return new Date(dateString).toLocaleString();
    } catch {
      return 'Invalid Date';
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-3 text-gray-600">Loading host details...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Error Loading Host</h3>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={fetchHostDetails}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!host) {
    return (
      <div className="text-center py-12">
        <Monitor className="h-12 w-12 text-gray-400 mx-auto mb-4" />
        <p className="text-gray-500">Host not found</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center space-x-4">
        <button
          onClick={() => navigate('/home')}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors duration-200"
        >
          <ArrowLeft className="h-5 w-5 text-gray-600" />
        </button>
        <div>
          <h1 className="text-3xl font-bold text-gray-900">{host.display_name}</h1>
          <p className="text-gray-600">{host.hostname}</p>
        </div>
        <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
          host.status === 'online' 
            ? 'bg-emerald-100 text-emerald-800' 
            : 'bg-red-100 text-red-800'
        }`}>
          {host.status}
        </span>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          {[
            { id: 'details', name: 'Details', icon: Monitor },
            { id: 'software', name: 'Software', icon: Package },
            { id: 'properties', name: 'Properties', icon: Settings },
          ].map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center py-2 px-1 border-b-2 font-medium text-sm transition-colors duration-200 ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <Icon className="h-4 w-4 mr-2" />
                {tab.name}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        {activeTab === 'details' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-500">UUID</label>
              <p className="text-sm text-gray-900 font-mono">{host.uuid}</p>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-500">Operating System</label>
              <p className="text-sm text-gray-900">{host.os_version}</p>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-500">Primary IP</label>
              <p className="text-sm text-gray-900">{host.primary_ip}</p>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-500">Uptime</label>
              <div className="flex items-center text-sm text-gray-900">
                <Calendar className="h-4 w-4 text-gray-400 mr-2" />
                {formatUptime(host.uptime)}
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-500">Memory</label>
              <div className="flex items-center text-sm text-gray-900">
                <MemoryStick className="h-4 w-4 text-gray-400 mr-2" />
                {formatMemory(host.memory)}
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-500">CPU</label>
              <div className="flex items-center text-sm text-gray-900">
                <Cpu className="h-4 w-4 text-gray-400 mr-2" />
                {host.cpu_brand}
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-500">Disk Space Available</label>
              <div className="flex items-center text-sm text-gray-900">
                <HardDrive className="h-4 w-4 text-gray-400 mr-2" />
                {host.gigs_disk_space_available} GB
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-500">Last Restarted</label>
              <p className="text-sm text-gray-900">{formatDate(host.last_restarted_at)}</p>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-500">Last Updated</label>
              <p className="text-sm text-gray-900">{formatDate(host.detail_updated_at)}</p>
            </div>
          </div>
        )}

        {activeTab === 'software' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-medium text-gray-900">Installed Software</h3>
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-2">
                  <label className="text-sm text-gray-600">Vulnerable Only:</label>
                  <input
                    type="checkbox"
                    checked={paginationParams.vulnerable}
                    onChange={(e) => handleVulnerableFilter(e.target.checked)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                </div>
                <button
                  onClick={handleExport}
                  className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Export All
                </button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th 
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                      onClick={() => handleSort('name')}
                    >
                      Name {paginationParams.order_key === 'name' && (
                        <span>{paginationParams.order_direction === 'asc' ? '↑' : '↓'}</span>
                      )}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Version</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Source</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Vulnerabilities</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {software.map((item) => (
                    <tr key={item.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <Package className="h-4 w-4 text-gray-400 mr-2" />
                          <button
                            onClick={() => navigate(`/software/${item.id}`)}
                            className="text-sm font-medium text-blue-600 hover:text-blue-800 transition-colors duration-200"
                          >
                            {item.name}
                          </button>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {item.installed_versions?.[0]?.version || 'N/A'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{item.source}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {item.installed_versions?.[0]?.vulnerabilities?.length > 0 ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                            {item.installed_versions[0].vulnerabilities.length}
                          </span>
                        ) : (
                          <span className="text-gray-500">0</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {software.length === 0 && (
              <div className="text-center py-8">
                <Package className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500">No software information available</p>
              </div>
            )}
            {software.length > 0 && (
              <div className="flex items-center justify-between px-4 py-3 bg-white border-t border-gray-200 sm:px-6">
                <div className="flex items-center">
                  <p className="text-sm text-gray-700">
                    Showing <span className="font-medium">{paginationParams.page * paginationParams.per_page + 1}</span> to{' '}
                    <span className="font-medium">
                      {Math.min((paginationParams.page + 1) * paginationParams.per_page, totalCount)}
                    </span>{' '}
                    of <span className="font-medium">{totalCount}</span> results
                  </p>
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => handlePageChange(paginationParams.page - 1)}
                    disabled={paginationParams.page === 0}
                    className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => handlePageChange(paginationParams.page + 1)}
                    disabled={(paginationParams.page + 1) * paginationParams.per_page >= totalCount}
                    className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'properties' && (
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-gray-900">System Properties</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <h4 className="font-medium text-gray-900">Hardware</h4>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-500">CPU Brand</span>
                    <span className="text-sm text-gray-900">{host.cpu_brand}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-500">Memory</span>
                    <span className="text-sm text-gray-900">{formatMemory(host.memory)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-500">Disk Space</span>
                    <span className="text-sm text-gray-900">{host.gigs_disk_space_available} GB</span>
                  </div>
                </div>
              </div>
              <div className="space-y-4">
                <h4 className="font-medium text-gray-900">Network</h4>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-500">Primary IP</span>
                    <span className="text-sm text-gray-900">{host.primary_ip}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-500">Hostname</span>
                    <span className="text-sm text-gray-900">{host.hostname}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};