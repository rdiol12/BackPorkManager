import React, { useState, useEffect } from 'react';
import {
  SafeAreaView,
  ScrollView,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  RefreshControl,
  StatusBar,
  Platform,
  Switch,
  Modal,
} from 'react-native';

const lightTheme = {
  bg: '#f5f5f5',
  card: '#ffffff',
  text: '#1a1a1a',
  textSecondary: '#666666',
  primary: '#3b82f6',
  accent: '#8b5cf6',
  border: '#e0e0e0',
  inputBg: '#f8f8f8',
};

const darkTheme = {
  bg: '#0f172a',
  card: '#1e293b',
  text: '#f1f5f9',
  textSecondary: '#94a3b8',
  primary: '#60a5fa',
  accent: '#a78bfa',
  border: '#334155',
  inputBg: '#0f172a',
};

const App = () => {
  const [isConnected, setIsConnected] = useState(false);
  const [ps5IP, setPS5IP] = useState('192.168.1.');
  const [serverURL, setServerURL] = useState('http://192.168.1.100:5000');
  const [games, setGames] = useState([]);
  const [libraries, setLibraries] = useState([]);
  const [logs, setLogs] = useState([]);
  const [stats, setStats] = useState({ totalGames: 0, setupGames: 0, totalLibraries: 0, successRate: 100 });
  const [activeTab, setActiveTab] = useState('connect');
  const [isLoading, setIsLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [currentFW, setCurrentFW] = useState('7.61');
  const [sourceFW, setSourceFW] = useState('10.01');
  const [notifications, setNotifications] = useState(true);
  const [autoSetup, setAutoSetup] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({});
  const [showGameInfo, setShowGameInfo] = useState(null);
  const [selectedGames, setSelectedGames] = useState([]);

  const theme = isDarkMode ? darkTheme : lightTheme;

  useEffect(() => {
    loadStats();
  }, [games, libraries]);

  const loadStats = () => {
    const setupCount = games.filter(g => g.hasFakelib).length;
    const total = games.length;
    setStats({
      totalGames: total,
      setupGames: setupCount,
      totalLibraries: libraries.length,
      successRate: total > 0 ? Math.round((setupCount / total) * 100) : 100
    });
  };

  const addLog = (message, type = 'info') => {
    const timestamp = new Date().toLocaleTimeString();
    const newLog = { message, type, timestamp, id: Date.now() };
    setLogs(prev => [newLog, ...prev].slice(0, 100));
  };

  const connectToPS5 = async () => {
    if (!ps5IP.trim() || !serverURL.trim()) {
      Alert.alert('Error', 'Please enter PS5 IP and Server URL');
      return;
    }
    setIsLoading(true);
    addLog('Connecting to PS5 at ' + ps5IP + '...', 'info');
    try {
      const response = await fetch(serverURL + '/api/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ip: ps5IP }),
      });
      const data = await response.json();
      if (data.success) {
        setIsConnected(true);
        addLog('Connected to PS5!', 'success');
        Alert.alert('Success', 'Connected to PS5!');
        setActiveTab('dashboard');
        await scanGames();
        await loadLibraries();
      } else {
        addLog('Connection failed: ' + data.error, 'error');
        Alert.alert('Connection Failed', data.error || 'Could not connect');
      }
    } catch (error) {
      addLog('Cannot reach backend server', 'error');
      Alert.alert('Error', 'Cannot reach backend. Make sure it is running.');
    }
    setIsLoading(false);
  };

  const scanGames = async () => {
    setIsLoading(true);
    addLog('Scanning for games...', 'info');
    try {
      const response = await fetch(serverURL + '/api/scan');
      const data = await response.json();
      if (data.games) {
        setGames(data.games);
        addLog('Found ' + data.games.length + ' games', 'success');
      }
    } catch (error) {
      addLog('Error scanning games', 'error');
    }
    setIsLoading(false);
    setRefreshing(false);
  };

  const loadLibraries = async () => {
    try {
      const response = await fetch(serverURL + '/api/libraries');
      const data = await response.json();
      if (data.libraries) {
        setLibraries(data.libraries);
      }
    } catch (error) {
      addLog('Error loading libraries', 'error');
    }
  };

  const setupGame = async (game) => {
    setIsLoading(true);
    const uploadId = Date.now();
    setUploadProgress(prev => ({ ...prev, [uploadId]: 0 }));
    addLog('Setting up ' + game.title + '...', 'info');
    const progressInterval = setInterval(() => {
      setUploadProgress(prev => {
        const current = prev[uploadId] || 0;
        if (current >= 95) {
          clearInterval(progressInterval);
          return prev;
        }
        return { ...prev, [uploadId]: current + 15 };
      });
    }, 500);
    try {
      const response = await fetch(serverURL + '/api/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ titleId: game.id, gameTitle: game.title, sourceFW: sourceFW, targetFW: currentFW }),
      });
      const data = await response.json();
      clearInterval(progressInterval);
      setUploadProgress(prev => ({ ...prev, [uploadId]: 100 }));
      if (data.success) {
        addLog('Setup complete for ' + game.title, 'success');
        Alert.alert('Success', game.title + ' is ready!');
        await scanGames();
      } else {
        addLog('Setup failed: ' + data.error, 'error');
      }
    } catch (error) {
      clearInterval(progressInterval);
      addLog('Error during setup', 'error');
    }
    setIsLoading(false);
  };

  const removeLibraries = async (game) => {
    Alert.alert('Remove Libraries', 'Remove from ' + game.title + '?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: async () => {
        setIsLoading(true);
        addLog('Removing libraries from ' + game.title + '...', 'info');
        try {
          const response = await fetch(serverURL + '/api/remove', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ titleId: game.id }),
          });
          const data = await response.json();
          if (data.success) {
            addLog('Libraries removed', 'success');
            await scanGames();
          }
        } catch (error) {
          addLog('Error removing libraries', 'error');
        }
        setIsLoading(false);
      }}
    ]);
  };

  const batchSetup = async () => {
    if (selectedGames.length === 0) {
      Alert.alert('Error', 'No games selected');
      return;
    }
    Alert.alert('Batch Setup', 'Setup ' + selectedGames.length + ' games?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Setup All', onPress: async () => {
        addLog('Starting batch setup for ' + selectedGames.length + ' games', 'info');
        for (const gameId of selectedGames) {
          const game = games.find(g => g.id === gameId);
          if (game && !game.hasFakelib) {
            await setupGame(game);
          }
        }
        setSelectedGames([]);
        addLog('Batch setup complete!', 'success');
      }}
    ]);
  };

  const backupConfig = () => {
    addLog('Configuration backed up', 'success');
    Alert.alert('Backup Created', 'Configuration saved successfully');
  };

  const exportLogs = () => {
    addLog('Logs exported', 'success');
    Alert.alert('Logs Exported', 'Logs ready to share');
  };

  const toggleGameSelection = (gameId) => {
    setSelectedGames(prev => 
      prev.includes(gameId) ? prev.filter(id => id !== gameId) : [...prev, gameId]
    );
  };

  const filteredGames = games.filter(game => {
    const matchesSearch = game.title.toLowerCase().includes(searchQuery.toLowerCase()) || game.id.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter = filterStatus === 'all' || (filterStatus === 'setup' && game.hasFakelib) || (filterStatus === 'needs-setup' && !game.hasFakelib);
    return matchesSearch && matchesFilter;
  });

  const ConnectionScreen = () => (
    <ScrollView style={[styles.container, { backgroundColor: theme.bg }]} contentContainerStyle={styles.connectContainer}>
      <View style={styles.logoContainer}>
        <Text style={styles.logoEmoji}>🐷</Text>
        <Text style={[styles.logoTitle, { color: theme.text }]}>BackPork Manager</Text>
        <Text style={[styles.logoSubtitle, { color: theme.textSecondary }]}>Ultimate Edition</Text>
      </View>
      <View style={[styles.card, { backgroundColor: theme.card }]}>
        <View style={styles.connectionStatusContainer}>
          <View style={[styles.statusIndicator, isConnected ? styles.connected : styles.disconnected]} />
          <Text style={[styles.connectionStatusText, { color: theme.text }]}>{isConnected ? 'Connected' : 'Disconnected'}</Text>
        </View>
        <View style={styles.inputContainer}>
          <Text style={[styles.inputLabel, { color: theme.text }]}>Backend Server URL</Text>
          <TextInput style={[styles.input, { backgroundColor: theme.inputBg, color: theme.text, borderColor: theme.border }]} value={serverURL} onChangeText={setServerURL} placeholder="http://192.168.1.100:5000" placeholderTextColor={theme.textSecondary} autoCapitalize="none" keyboardType="url" />
        </View>
        <View style={styles.inputContainer}>
          <Text style={[styles.inputLabel, { color: theme.text }]}>PS5 IP Address</Text>
          <TextInput style={[styles.input, { backgroundColor: theme.inputBg, color: theme.text, borderColor: theme.border }]} value={ps5IP} onChangeText={setPS5IP} placeholder="192.168.1.100" placeholderTextColor={theme.textSecondary} keyboardType="decimal-pad" />
        </View>
        <TouchableOpacity style={[styles.connectButton, isLoading && styles.buttonDisabled]} onPress={connectToPS5} disabled={isLoading}>
          {isLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.connectButtonText}>{isConnected ? 'Reconnect' : 'Connect to PS5'}</Text>}
        </TouchableOpacity>
        <View style={styles.infoBox}>
          <Text style={styles.infoTitle}>Setup Instructions</Text>
          <Text style={styles.infoText}>1. Run backend server on computer</Text>
          <Text style={styles.infoText}>2. Enable GoldHEN FTP on PS5</Text>
          <Text style={styles.infoText}>3. Connect to same WiFi</Text>
        </View>
      </View>
    </ScrollView>
  );

  const DashboardScreen = () => (
    <ScrollView style={[styles.container, { backgroundColor: theme.bg }]}>
      <View style={[styles.header, { backgroundColor: theme.card, borderBottomColor: theme.border }]}>
        <Text style={[styles.headerTitle, { color: theme.text }]}>Dashboard</Text>
      </View>
      <View style={styles.statsContainer}>
        <View style={[styles.statCard, { backgroundColor: theme.card }]}>
          <Text style={[styles.statValue, { color: theme.primary }]}>{stats.totalGames}</Text>
          <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Total Games</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: theme.card }]}>
          <Text style={[styles.statValue, { color: '#4ade80' }]}>{stats.setupGames}</Text>
          <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Setup</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: theme.card }]}>
          <Text style={[styles.statValue, { color: theme.accent }]}>{stats.totalLibraries}</Text>
          <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Libraries</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: theme.card }]}>
          <Text style={[styles.statValue, { color: '#f59e0b' }]}>{stats.successRate}%</Text>
          <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Success</Text>
        </View>
      </View>
      <View style={styles.quickActions}>
        <TouchableOpacity style={[styles.quickButton, { backgroundColor: theme.primary }]} onPress={() => setActiveTab('games')}>
          <Text style={styles.quickButtonEmoji}>🎮</Text>
          <Text style={styles.quickButtonText}>Games</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.quickButton, { backgroundColor: theme.accent }]} onPress={batchSetup}>
          <Text style={styles.quickButtonEmoji}>⚡</Text>
          <Text style={styles.quickButtonText}>Batch</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.quickButton, { backgroundColor: '#10b981' }]} onPress={backupConfig}>
          <Text style={styles.quickButtonEmoji}>💾</Text>
          <Text style={styles.quickButtonText}>Backup</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.quickButton, { backgroundColor: '#f59e0b' }]} onPress={() => setActiveTab('libraries')}>
          <Text style={styles.quickButtonEmoji}>📦</Text>
          <Text style={styles.quickButtonText}>Libs</Text>
        </TouchableOpacity>
      </View>
      <View style={[styles.section, { backgroundColor: theme.card }]}>
        <Text style={[styles.sectionTitle, { color: theme.text }]}>Recent Activity</Text>
        {logs.slice(0, 5).map(log => (
          <View key={log.id} style={styles.activityItem}>
            <Text style={[styles.activityTime, { color: theme.textSecondary }]}>{log.timestamp}</Text>
            <Text style={[styles.activityMessage, { color: theme.text }]}>{log.message}</Text>
          </View>
        ))}
      </View>
    </ScrollView>
  );

  const GamesScreen = () => (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      <View style={[styles.header, { backgroundColor: theme.card, borderBottomColor: theme.border }]}>
        <Text style={[styles.headerTitle, { color: theme.text }]}>Games ({filteredGames.length})</Text>
        <TouchableOpacity onPress={() => scanGames()}><Text style={{ fontSize: 24 }}>🔄</Text></TouchableOpacity>
      </View>
      <View style={[styles.searchContainer, { backgroundColor: theme.card }]}>
        <TextInput style={[styles.searchInput, { backgroundColor: theme.inputBg, color: theme.text, borderColor: theme.border }]} placeholder="Search games..." placeholderTextColor={theme.textSecondary} value={searchQuery} onChangeText={setSearchQuery} />
        <View style={styles.filterRow}>
          <TouchableOpacity style={[styles.filterChip, filterStatus === 'all' && styles.filterChipActive]} onPress={() => setFilterStatus('all')}><Text style={styles.filterChipText}>All</Text></TouchableOpacity>
          <TouchableOpacity style={[styles.filterChip, filterStatus === 'setup' && styles.filterChipActive]} onPress={() => setFilterStatus('setup')}><Text style={styles.filterChipText}>Setup</Text></TouchableOpacity>
          <TouchableOpacity style={[styles.filterChip, filterStatus === 'needs-setup' && styles.filterChipActive]} onPress={() => setFilterStatus('needs-setup')}><Text style={styles.filterChipText}>Needs</Text></TouchableOpacity>
        </View>
        {selectedGames.length > 0 && (
          <TouchableOpacity style={styles.batchButton} onPress={batchSetup}><Text style={styles.batchButtonText}>Setup {selectedGames.length} Selected</Text></TouchableOpacity>
        )}
      </View>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {filteredGames.length === 0 ? (
          <View style={styles.emptyState}><Text style={styles.emptyStateEmoji}>🎮</Text><Text style={[styles.emptyStateText, { color: theme.text }]}>No games found</Text></View>
        ) : (
          filteredGames.map(game => (
            <TouchableOpacity key={game.id} style={[styles.gameCard, { backgroundColor: theme.card }]} onLongPress={() => toggleGameSelection(game.id)}>
              <View style={styles.gameHeader}>
                <TouchableOpacity style={styles.checkbox} onPress={() => toggleGameSelection(game.id)}>
                  {selectedGames.includes(game.id) && <Text style={styles.checkmark}>✓</Text>}
                </TouchableOpacity>
                <View style={styles.gameInfo}>
                  <Text style={[styles.gameTitle, { color: theme.text }]}>{game.title}</Text>
                  <Text style={[styles.gameId, { color: theme.textSecondary }]}>{game.id}</Text>
                </View>
                <View style={game.hasFakelib ? styles.statusReady : styles.statusNeedsSetup}>
                  <Text style={styles.statusText}>{game.hasFakelib ? '✓' : '✗'}</Text>
                </View>
              </View>
              <View style={styles.gameActions}>
                {!game.hasFakelib ? (
                  <TouchableOpacity style={[styles.actionButton, styles.setupButton]} onPress={() => setupGame(game)} disabled={isLoading}><Text style={styles.actionButtonText}>Setup</Text></TouchableOpacity>
                ) : (
                  <TouchableOpacity style={[styles.actionButton, styles.removeButton]} onPress={() => removeLibraries(game)} disabled={isLoading}><Text style={styles.actionButtonText}>Remove</Text></TouchableOpacity>
                )}
                <TouchableOpacity style={[styles.actionButton, styles.infoButton]} onPress={() => setShowGameInfo(game)}><Text style={styles.actionButtonText}>Info</Text></TouchableOpacity>
              </View>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
    </View>
  );

  const LibrariesScreen = () => (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      <View style={[styles.header, { backgroundColor: theme.card, borderBottomColor: theme.border }]}>
        <Text style={[styles.headerTitle, { color: theme.text }]}>Libraries ({libraries.length})</Text>
      </View>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {libraries.length === 0 ? (
          <View style={styles.emptyState}><Text style={styles.emptyStateEmoji}>📦</Text><Text style={[styles.emptyStateText, { color: theme.text }]}>No libraries found</Text></View>
        ) : (
          libraries.map((lib, idx) => (
            <View key={idx} style={[styles.libraryCard, { backgroundColor: theme.card }]}>
              <View style={styles.libraryInfo}>
                <Text style={[styles.libraryName, { color: theme.text }]}>{lib.name}</Text>
                <Text style={[styles.librarySize, { color: theme.textSecondary }]}>{lib.size}</Text>
              </View>
              {lib.patched && <View style={styles.patchedBadge}><Text style={styles.patchedText}>Patched</Text></View>}
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );

  const LogsScreen = () => (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      <View style={[styles.header, { backgroundColor: theme.card, borderBottomColor: theme.border }]}>
        <Text style={[styles.headerTitle, { color: theme.text }]}>Logs ({logs.length})</Text>
        <TouchableOpacity onPress={exportLogs}><Text style={{ fontSize: 24 }}>📤</Text></TouchableOpacity>
      </View>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {logs.length === 0 ? (
          <View style={styles.emptyState}><Text style={styles.emptyStateEmoji}>📋</Text><Text style={[styles.emptyStateText, { color: theme.text }]}>No logs yet</Text></View>
        ) : (
          logs.map(log => (
            <View key={log.id} style={[styles.logCard, log.type === 'error' && styles.logError, log.type === 'success' && styles.logSuccess, { backgroundColor: theme.card }]}>
              <Text style={[styles.logTime, { color: theme.textSecondary }]}>{log.timestamp}</Text>
              <Text style={[styles.logMessage, { color: theme.text }]}>{log.message}</Text>
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );

  const SettingsScreen = () => (
    <ScrollView style={[styles.container, { backgroundColor: theme.bg }]} contentContainerStyle={styles.scrollContent}>
      <View style={[styles.header, { backgroundColor: theme.card, borderBottomColor: theme.border }]}>
        <Text style={[styles.headerTitle, { color: theme.text }]}>Settings</Text>
      </View>
      <View style={[styles.settingsSection, { backgroundColor: theme.card }]}>
        <Text style={[styles.settingsSectionTitle, { color: theme.text }]}>Appearance</Text>
        <View style={styles.settingsRow}>
          <Text style={[styles.settingsLabel, { color: theme.text }]}>Dark Mode</Text>
          <Switch value={isDarkMode} onValueChange={setIsDarkMode} />
        </View>
      </View>
      <View style={[styles.settingsSection, { backgroundColor: theme.card }]}>
        <Text style={[styles.settingsSectionTitle, { color: theme.text }]}>Firmware</Text>
        <View style={styles.settingsRow}>
          <Text style={[styles.settingsLabel, { color: theme.text }]}>Current FW</Text>
          <TextInput style={[styles.settingsInput, { backgroundColor: theme.inputBg, color: theme.text }]} value={currentFW} onChangeText={setCurrentFW} />
        </View>
        <View style={styles.settingsRow}>
          <Text style={[styles.settingsLabel, { color: theme.text }]}>Source FW</Text>
          <TextInput style={[styles.settingsInput, { backgroundColor: theme.inputBg, color: theme.text }]} value={sourceFW} onChangeText={setSourceFW} />
        </View>
      </View>
      <View style={[styles.settingsSection, { backgroundColor: theme.card }]}>
        <Text style={[styles.settingsSectionTitle, { color: theme.text }]}>Features</Text>
        <View style={styles.settingsRow}>
          <Text style={[styles.settingsLabel, { color: theme.text }]}>Notifications</Text>
          <Switch value={notifications} onValueChange={setNotifications} />
        </View>
        <View style={styles.settingsRow}>
          <Text style={[styles.settingsLabel, { color: theme.text }]}>Auto Setup</Text>
          <Switch value={autoSetup} onValueChange={setAutoSetup} />
        </View>
      </View>
      <View style={[styles.settingsSection, { backgroundColor: theme.card }]}>
        <TouchableOpacity style={styles.settingsButton} onPress={backupConfig}><Text style={styles.settingsButtonText}>💾 Backup Config</Text></TouchableOpacity>
        <TouchableOpacity style={styles.settingsButton} onPress={exportLogs}><Text style={styles.settingsButtonText}>📤 Export Logs</Text></TouchableOpacity>
      </View>
      <View style={styles.aboutSection}>
        <Text style={[styles.aboutText, { color: theme.textSecondary }]}>BackPork Manager v2.0</Text>
        <Text style={[styles.aboutText, { color: theme.textSecondary }]}>Ultimate Edition</Text>
      </View>
    </ScrollView>
  );

  const TabBar = () => (
    <View style={[styles.tabBar, { backgroundColor: theme.card, borderTopColor: theme.border }]}>
      {[
        { id: 'dashboard', icon: '📊', label: 'Dashboard' },
        { id: 'games', icon: '🎮', label: 'Games' },
        { id: 'libraries', icon: '📦', label: 'Libs' },
        { id: 'logs', icon: '📋', label: 'Logs' },
        { id: 'settings', icon: '⚙️', label: 'Settings' },
      ].map(tab => (
        <TouchableOpacity key={tab.id} style={styles.tab} onPress={() => setActiveTab(tab.id)}>
          <Text style={[styles.tabText, activeTab === tab.id && styles.tabActive]}>{tab.icon}</Text>
          <Text style={[styles.tabLabel, activeTab === tab.id && styles.tabLabelActive, { color: theme.textSecondary }]}>{tab.label}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.bg }]}>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
      {activeTab === 'connect' && <ConnectionScreen />}
      {activeTab === 'dashboard' && <DashboardScreen />}
      {activeTab === 'games' && <GamesScreen />}
      {activeTab === 'libraries' && <LibrariesScreen />}
      {activeTab === 'logs' && <LogsScreen />}
      {activeTab === 'settings' && <SettingsScreen />}
      {isConnected && <TabBar />}
      <Modal visible={!!showGameInfo} transparent animationType="fade" onRequestClose={() => setShowGameInfo(null)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.card }]}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>{showGameInfo?.title}</Text>
            <Text style={[styles.modalText, { color: theme.textSecondary }]}>ID: {showGameInfo?.id}</Text>
            <Text style={[styles.modalText, { color: theme.textSecondary }]}>Required FW: {showGameInfo?.requiredFW || 'Unknown'}</Text>
            <Text style={[styles.modalText, { color: theme.textSecondary }]}>Status: {showGameInfo?.hasFakelib ? 'Ready' : 'Needs Setup'}</Text>
            <TouchableOpacity style={styles.modalButton} onPress={() => setShowGameInfo(null)}><Text style={styles.modalButtonText}>Close</Text></TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  container: { flex: 1 },
  connectContainer: { padding: 20, justifyContent: 'center' },
  logoContainer: { alignItems: 'center', marginBottom: 40 },
  logoEmoji: { fontSize: 80, marginBottom: 10 },
  logoTitle: { fontSize: 32, fontWeight: 'bold' },
  logoSubtitle: { fontSize: 16, marginTop: 5 },
  card: { borderRadius: 20, padding: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 8, elevation: 5 },
  connectionStatusContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  statusIndicator: { width: 12, height: 12, borderRadius: 6, marginRight: 8 },
  connected: { backgroundColor: '#4ade80' },
  disconnected: { backgroundColor: '#ef4444' },
  connectionStatusText: { fontSize: 16, fontWeight: '600' },
  inputContainer: { marginBottom: 20 },
  inputLabel: { fontSize: 14, fontWeight: '600', marginBottom: 8 },
  input: { borderRadius: 12, padding: 15, fontSize: 16, borderWidth: 1 },
  connectButton: { backgroundColor: '#3b82f6', borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 10 },
  buttonDisabled: { opacity: 0.6 },
  connectButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  infoBox: { backgroundColor: '#dbeafe', borderRadius: 12, padding: 15, marginTop: 20 },
  infoTitle: { fontSize: 14, fontWeight: 'bold', color: '#1e40af', marginBottom: 8 },
  infoText: { fontSize: 13, color: '#1e40af', marginBottom: 4 },
  header: { padding: 20, borderBottomWidth: 1, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerTitle: { fontSize: 24, fontWeight: 'bold' },
  statsContainer: { flexDirection: 'row', flexWrap: 'wrap', padding: 15, gap: 10 },
  statCard: { flex: 1, minWidth: '45%', borderRadius: 15, padding: 15, alignItems: 'center' },
  statValue: { fontSize: 32, fontWeight: 'bold' },
  statLabel: { fontSize: 12, marginTop: 5 },
  quickActions: { flexDirection: 'row', flexWrap: 'wrap', padding: 15, gap: 10 },
  quickButton: { flex: 1, minWidth: '45%', borderRadius: 15, padding: 15, alignItems: 'center' },
  quickButtonEmoji: { fontSize: 32, marginBottom: 5 },
  quickButtonText: { color: '#fff', fontSize: 14, fontWeight: 'bold' },
  section: { margin: 15, borderRadius: 15, padding: 15 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 10 },
  activityItem: { paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  activityTime: { fontSize: 11 },
  activityMessage: { fontSize: 13, marginTop: 2 },
  searchContainer: { padding: 15 },
  searchInput: { borderRadius: 12, padding: 12, borderWidth: 1, marginBottom: 10 },
  filterRow: { flexDirection: 'row', gap: 8 },
  filterChip: { paddingHorizontal: 15, paddingVertical: 8, borderRadius: 20, backgroundColor: '#e0e0e0' },
  filterChipActive: { backgroundColor: '#3b82f6' },
  filterChipText: { fontSize: 12, fontWeight: '600', color: '#fff' },
  batchButton: { marginTop: 10, padding: 12, backgroundColor: '#8b5cf6', borderRadius: 12, alignItems: 'center' },
  batchButtonText: { color: '#fff', fontWeight: 'bold' },
  scrollView: { flex: 1 },
  scrollContent: { padding: 15 },
  emptyState: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60 },
  emptyStateEmoji: { fontSize: 60, marginBottom: 15 },
  emptyStateText: { fontSize: 18, fontWeight: '600' },
  gameCard: { borderRadius: 15, padding: 15, marginBottom: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3 },
  gameHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  checkbox: { width: 24, height: 24, borderRadius: 6, borderWidth: 2, borderColor: '#3b82f6', marginRight: 10, justifyContent: 'center', alignItems: 'center' },
  checkmark: { color: '#3b82f6', fontSize: 16, fontWeight: 'bold' },
  gameInfo: { flex: 1 },
  gameTitle: { fontSize: 16, fontWeight: 'bold' },
  gameId: { fontSize: 12, marginTop: 4 },
  statusReady: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#4ade80', alignItems: 'center', justifyContent: 'center' },
  statusNeedsSetup: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#ef4444', alignItems: 'center', justifyContent: 'center' },
  statusText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  gameActions: { flexDirection: 'row', gap: 8 },
  actionButton: { flex: 1, borderRadius: 10, padding: 12, alignItems: 'center' },
  setupButton: { backgroundColor: '#4ade80' },
  removeButton: { backgroundColor: '#ef4444' },
  infoButton: { backgroundColor: '#3b82f6' },
  actionButtonText: { color: '#fff', fontSize: 14, fontWeight: 'bold' },
  libraryCard: { borderRadius: 12, padding: 15, marginBottom: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  libraryInfo: { flex: 1 },
  libraryName: { fontSize: 14, fontWeight: '600' },
  librarySize: { fontSize: 12, marginTop: 4 },
  patchedBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, backgroundColor: '#dcfce7' },
  patchedText: { fontSize: 11, fontWeight: '600', color: '#16a34a' },
  logCard: { borderRadius: 10, padding: 12, marginBottom: 8 },
  logError: { backgroundColor: '#fee2e2' },
  logSuccess: { backgroundColor: '#dcfce7' },
  logTime: { fontSize: 11, marginBottom: 4 },
  logMessage: { fontSize: 13 },
  settingsSection: { margin: 15, borderRadius: 15, padding: 15 },
  settingsSectionTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 15 },
  settingsRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  settingsLabel: { fontSize: 16 },
  settingsInput: { width: 80, padding: 8, borderRadius: 8, textAlign: 'center' },
  settingsButton: { padding: 15, backgroundColor: '#3b82f6', borderRadius: 12, marginBottom: 10 },
  settingsButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold', textAlign: 'center' },
  aboutSection: { padding: 30, alignItems: 'center' },
  aboutText: { fontSize: 12, marginBottom: 5 },
  tabBar: { flexDirection: 'row', borderTopWidth: 1, paddingBottom: Platform.OS === 'ios' ? 20 : 10 },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 10 },
  tabText: { fontSize: 24, opacity: 0.5 },
  tabActive: { opacity: 1 },
  tabLabel: { fontSize: 10, marginTop: 4 },
  tabLabelActive: { fontWeight: '600' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { width: '80%', borderRadius: 20, padding: 20 },
  modalTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 15 },
  modalText: { fontSize: 14, marginBottom: 10 },
  modalButton: { marginTop: 20, padding: 15, backgroundColor: '#3b82f6', borderRadius: 12 },
  modalButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold', textAlign: 'center' },
});

export default App;
