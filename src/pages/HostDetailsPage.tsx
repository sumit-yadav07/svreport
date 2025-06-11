import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Monitor, Package, Settings, Calendar, HardDrive, Cpu, MemoryStick, AlertCircle } from 'lucide-react';
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

interface Software {
  id: number;
  name: string;
  version: string;
  source: string;
}

export const HostDetailsPage: React.FC = () => {
  const [host, setHost] = useState<HostDetails | null>(null);
  const [software, setSoftware] = useState<Software[]>([]);
  const [activeTab, setActiveTab] = useState<'details' | 'software' | 'properties'>('details');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
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
  }, [id, activeTab]);

  const fetchHostDetails = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`http://localhost:3001/api/latest/fleet/hosts/${id}?exclude_software=true`, {
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

  const fetchHostSoftware = async () => {
    try {
      const response = await fetch(`http://localhost:3001/api/latest/fleet/hosts/${id}/software`, {
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      
      if (response.ok) {
        const data = await response.json();
        setSoftware(data.software || []);
      }
    } catch (error) {
      console.error('Error fetching host software:', error);
    }
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
            <h3 className="text-lg font-medium text-gray-900">Installed Software</h3>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Version</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Source</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {software.map((item) => (
                    <tr key={item.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <Package className="h-4 w-4 text-gray-400 mr-2" />
                          <span className="text-sm font-medium text-gray-900">{item.name}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{item.version}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{item.source}</td>
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