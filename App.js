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
  const [libraries, setLibraries] = useState([]);
  const [logs, setLogs] = useState([]);
  const [activeTab, setActiveTab] = useState('connect');
  const [isLoading, setIsLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [currentFW, setCurrentFW] = useState('7.61');
  const [sourceFW, setSourceFW] = useState('10.01');

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
    addLog(`Connecting to PS5 at ${ps5IP}...`, 'info');

    try {
      const response = await fetch(`${serverURL}/api/connect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/j
