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
} from 'react-native';

const App = () => {
  const [isConnected, setIsConnected] = useState(false);
  const [ps5IP, setPS5IP] = useState('192.168.1.');
  const [serverURL, setServerURL] = useState('http://192.168.1.100:5000');
  const [games, setGames] = useState([]);
  const [logs, setLogs] = useState([]);
  const [activeTab, setActiveTab] = useState('connect');
  const [isLoading, setIsLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const addLog = (message, type = 'info') => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [...prev, { message, type, timestamp, id: Date.now() }]);
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
        setActiveTab('games');
        scanGames();
      } else {
        addLog('Connection failed: ' + data.error, 'error');
        Alert.alert('Connection Failed', data.error || 'Could not connect');
      }
    } catch (error) {
      addLog('Cannot reach backend server', 'error');
      Alert.alert('Error', 'Cannot reach backend server');
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

  const setupGame = (game) => {
    Alert.alert('Setup Game', 'Setup ' + game.title + ' with libraries?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Setup',
        onPress: async () => {
          setIsLoading(true);
          addLog('Setting up ' + game.title + '...', 'info');
          try {
            const response = await fetch(serverURL + '/api/setup', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                titleId: game.id,
                gameTitle: game.title,
                sourceFW: '10.01',
                targetFW: '7.61',
              }),
            });
            const data = await response.json();
            if (data.success) {
              addLog('Setup complete!', 'success');
              Alert.alert('Success', game.title + ' is ready!');
              await scanGames();
            } else {
              addLog('Setup failed: ' + data.error, 'error');
            }
          } catch (error) {
            addLog('Error during setup', 'error');
          }
          setIsLoading(false);
        },
      },
    ]);
  };

  const ConnectionScreen = () => (
    <ScrollView style={styles.container} contentContainerStyle={styles.connectContainer}>
      <View style={styles.logoContainer}>
        <Text style={styles.logoEmoji}>🐷</Text>
        <Text style={styles.logoTitle}>BackPork Manager</Text>
        <Text style={styles.logoSubtitle}>PS5 Library Manager</Text>
      </View>
      <View style={styles.card}>
        <View style={styles.connectionStatusContainer}>
          <View style={[styles.statusIndicator, isConnected ? styles.connected : styles.disconnected]} />
          <Text style={styles.connectionStatusText}>
            {isConnected ? 'Connected' : 'Disconnected'}
          </Text>
        </View>
        <View style={styles.inputContainer}>
          <Text style={styles.inputLabel}>Backend Server URL</Text>
          <TextInput
            style={styles.input}
            value={serverURL}
            onChangeText={setServerURL}
            placeholder="http://192.168.1.100:5000"
            placeholderTextColor="#999"
            autoCapitalize="none"
            keyboardType="url"
          />
        </View>
        <View style={styles.inputContainer}>
          <Text style={styles.inputLabel}>PS5 IP Address</Text>
          <TextInput
            style={styles.input}
            value={ps5IP}
            onChangeText={setPS5IP}
            placeholder="192.168.1.100"
            placeholderTextColor="#999"
            keyboardType="decimal-pad"
          />
        </View>
        <TouchableOpacity
          style={[styles.connectButton, isLoading && styles.buttonDisabled]}
          onPress={connectToPS5}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.connectButtonText}>Connect to PS5</Text>
          )}
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

  const GamesScreen = () => (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Games ({games.length})</Text>
      </View>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); scanGames(); }} />}
      >
        {games.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateEmoji}>🎮</Text>
            <Text style={styles.emptyStateText}>No games found</Text>
          </View>
        ) : (
          games.map((game) => (
            <View key={game.id} style={styles.gameCard}>
              <View style={styles.gameHeader}>
                <View style={styles.gameInfo}>
                  <Text style={styles.gameTitle}>{game.title}</Text>
                  <Text style={styles.gameId}>{game.id}</Text>
                </View>
                <View style={game.hasFakelib ? styles.statusReady : styles.statusNeedsSetup}>
                  <Text style={styles.statusText}>{game.hasFakelib ? '✓' : '✗'}</Text>
                </View>
              </View>
              <TouchableOpacity
                style={[styles.actionButton, game.hasFakelib ? styles.removeButton : styles.setupButton]}
                onPress={() => setupGame(game)}
                disabled={isLoading}
              >
                <Text style={styles.actionButtonText}>
                  {game.hasFakelib ? 'Remove' : 'Setup'}
                </Text>
              </TouchableOpacity>
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );

  const LogsScreen = () => (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Logs ({logs.length})</Text>
      </View>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {logs.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateEmoji}>📋</Text>
            <Text style={styles.emptyStateText}>No logs yet</Text>
          </View>
        ) : (
          [...logs].reverse().map((log) => (
            <View key={log.id} style={[styles.logCard, log.type === 'error' && styles.logError, log.type === 'success' && styles.logSuccess]}>
              <Text style={styles.logTime}>{log.timestamp}</Text>
              <Text style={styles.logMessage}>{log.message}</Text>
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );

  const TabBar = () => (
    <View style={styles.tabBar}>
      <TouchableOpacity style={styles.tab} onPress={() => setActiveTab('games')}>
        <Text style={[styles.tabText, activeTab === 'games' && styles.tabActive]}>🎮</Text>
        <Text style={[styles.tabLabel, activeTab === 'games' && styles.tabLabelActive]}>Games</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.tab} onPress={() => setActiveTab('logs')}>
        <Text style={[styles.tabText, activeTab === 'logs' && styles.tabActive]}>📋</Text>
        <Text style={[styles.tabLabel, activeTab === 'logs' && styles.tabLabelActive]}>Logs</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.tab} onPress={() => setActiveTab('connect')}>
        <Text style={[styles.tabText, activeTab === 'connect' && styles.tabActive]}>{isConnected ? '📡' : '❌'}</Text>
        <Text style={[styles.tabLabel, activeTab === 'connect' && styles.tabLabelActive]}>Connect</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" />
      {activeTab === 'connect' && <ConnectionScreen />}
      {activeTab === 'games' && <GamesScreen />}
      {activeTab === 'logs' && <LogsScreen />}
      {isConnected && <TabBar />}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#f5f5f5' },
  container: { flex: 1 },
  connectContainer: { padding: 20, justifyContent: 'center' },
  logoContainer: { alignItems: 'center', marginBottom: 40 },
  logoEmoji: { fontSize: 80, marginBottom: 10 },
  logoTitle: { fontSize: 32, fontWeight: 'bold', color: '#1a1a1a' },
  logoSubtitle: { fontSize: 16, color: '#666', marginTop: 5 },
  card: { backgroundColor: '#fff', borderRadius: 20, padding: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 8, elevation: 5 },
  connectionStatusContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  statusIndicator: { width: 12, height: 12, borderRadius: 6, marginRight: 8 },
  connected: { backgroundColor: '#4ade80' },
  disconnected: { backgroundColor: '#ef4444' },
  connectionStatusText: { fontSize: 16, fontWeight: '600', color: '#333' },
  inputContainer: { marginBottom: 20 },
  inputLabel: { fontSize: 14, fontWeight: '600', color: '#333', marginBottom: 8 },
  input: { backgroundColor: '#f8f8f8', borderRadius: 12, padding: 15, fontSize: 16, borderWidth: 1, borderColor: '#e0e0e0' },
  connectButton: { backgroundColor: '#3b82f6', borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 10 },
  buttonDisabled: { opacity: 0.6 },
  connectButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  infoBox: { backgroundColor: '#dbeafe', borderRadius: 12, padding: 15, marginTop: 20 },
  infoTitle: { fontSize: 14, fontWeight: 'bold', color: '#1e40af', marginBottom: 8 },
  infoText: { fontSize: 13, color: '#1e40af', marginBottom: 4 },
  header: { backgroundColor: '#fff', padding: 20, borderBottomWidth: 1, borderBottomColor: '#e0e0e0' },
  headerTitle: { fontSize: 24, fontWeight: 'bold', color: '#1a1a1a' },
  scrollView: { flex: 1 },
  scrollContent: { padding: 15 },
  emptyState: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60 },
  emptyStateEmoji: { fontSize: 60, marginBottom: 15 },
  emptyStateText: { fontSize: 18, fontWeight: '600', color: '#666' },
  gameCard: { backgroundColor: '#fff', borderRadius: 15, padding: 15, marginBottom: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3 },
  gameHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 },
  gameInfo: { flex: 1 },
  gameTitle: { fontSize: 16, fontWeight: 'bold', color: '#1a1a1a' },
  gameId: { fontSize: 12, color: '#666', marginTop: 4 },
  statusReady: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#4ade80', alignItems: 'center', justifyContent: 'center' },
  statusNeedsSetup: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#ef4444', alignItems: 'center', justifyContent: 'center' },
  statusText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  actionButton: { borderRadius: 10, padding: 12, alignItems: 'center' },
  setupButton: { backgroundColor: '#4ade80' },
  removeButton: { backgroundColor: '#ef4444' },
  actionButtonText: { color: '#fff', fontSize: 14, fontWeight: 'bold' },
  logCard: { backgroundColor: '#e3f2fd', borderRadius: 10, padding: 12, marginBottom: 8 },
  logError: { backgroundColor: '#fee2e2' },
  logSuccess: { backgroundColor: '#dcfce7' },
  logTime: { fontSize: 11, color: '#666', marginBottom: 4 },
  logMessage: { fontSize: 13, color: '#1a1a1a' },
  tabBar: { flexDirection: 'row', backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#e0e0e0', paddingBottom: Platform.OS === 'ios' ? 20 : 10 },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 10 },
  tabText: { fontSize: 24, opacity: 0.5 },
  tabActive: { opacity: 1 },
  tabLabel: { fontSize: 11, color: '#999', marginTop: 4 },
  tabLabelActive: { color: '#3b82f6', fontWeight: '600' },
});

export default App;
