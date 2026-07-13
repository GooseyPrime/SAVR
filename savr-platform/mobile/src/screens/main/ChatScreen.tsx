import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { useAuth } from '../../contexts/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import { chatWithAI } from '../../utils/api';
import { colors, radii } from '../../theme';

interface Message {
  id: string;
  text: string;
  sender: 'user' | 'ai';
  timestamp: Date;
}

export default function ChatScreen() {
  const { userData } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    if (userData?.subscriptionTier !== 'pro') {
      Alert.alert(
        'Pro Feature',
        'AI Chef chat is only available for Pro subscribers. Upgrade to unlock this feature!',
        [{ text: 'OK' }]
      );
    }
  }, [userData]);

  const handleSend = async () => {
    if (!inputText.trim() || loading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      text: inputText,
      sender: 'user',
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputText('');
    setLoading(true);

    try {
      const response = await chatWithAI({
        messages: [
          ...messages.slice(-10).map((message) => ({
            role: message.sender === 'user' ? 'user' as const : 'assistant' as const,
            content: message.text,
          })),
          { role: 'user', content: inputText },
        ],
        context: {},
      });
      
      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: response.message || response.reply || 'Sorry, I could not process that.',
        sender: 'ai',
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, aiMessage]);
    } catch (error) {
      Alert.alert('Error', 'Failed to get response from AI Chef');
    } finally {
      setLoading(false);
    }
  };

  if (userData?.subscriptionTier !== 'pro') {
    return (
      <View style={styles.proOnlyContainer}>
        <Ionicons name="lock-closed" size={64} color={colors.foregroundMuted} />
        <Text style={styles.proOnlyTitle}>Pro Feature</Text>
        <Text style={styles.proOnlyText}>
          Upgrade to Pro to chat with our AI Chef and get personalized cooking advice!
        </Text>
        <TouchableOpacity style={styles.upgradeButton}>
          <Text style={styles.upgradeButtonText}>Upgrade to Pro</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View
            style={[
              styles.messageContainer,
              item.sender === 'user' ? styles.userMessage : styles.aiMessage,
            ]}
          >
            <Text
              style={[
                styles.messageText,
                item.sender === 'user' ? styles.userMessageText : styles.aiMessageText,
              ]}
            >
              {item.text}
            </Text>
          </View>
        )}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>👨‍🍳</Text>
            <Text style={styles.emptyTitle}>AI Chef at Your Service</Text>
            <Text style={styles.emptyText}>
              Ask me anything about cooking, recipes, or meal planning!
            </Text>
          </View>
        }
        contentContainerStyle={styles.messagesContent}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd()}
      />

      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          placeholder="Ask the AI Chef..."
          placeholderTextColor={colors.foregroundMuted}
          value={inputText}
          onChangeText={setInputText}
          multiline
          maxLength={500}
        />
        <TouchableOpacity
          style={[styles.sendButton, loading && styles.sendButtonDisabled]}
          onPress={handleSend}
          disabled={loading || !inputText.trim()}
        >
          {loading ? (
            <Ionicons name="hourglass-outline" size={24} color={colors.primaryForeground} />
          ) : (
            <Ionicons name="send" size={24} color={colors.primaryForeground} />
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  messagesContent: {
    padding: 16,
    flexGrow: 1,
  },
  messageContainer: {
    maxWidth: '80%',
    marginBottom: 12,
    padding: 12,
    borderRadius: radii.lg,
  },
  userMessage: {
    alignSelf: 'flex-end',
    backgroundColor: colors.primary,
  },
  aiMessage: {
    alignSelf: 'flex-start',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  messageText: {
    fontSize: 16,
    lineHeight: 22,
  },
  userMessageText: {
    color: colors.primaryForeground,
  },
  aiMessageText: {
    color: colors.foreground,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 60,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.foreground,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 16,
    color: colors.foregroundMuted,
    textAlign: 'center',
    paddingHorizontal: 32,
  },
  inputContainer: {
    flexDirection: 'row',
    padding: 16,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.full,
    paddingHorizontal: 16,
    paddingVertical: 8,
    fontSize: 16,
    maxHeight: 100,
    marginRight: 8,
    color: colors.foreground,
    backgroundColor: colors.background,
  },
  sendButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
  proOnlyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: colors.background,
  },
  proOnlyTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.foreground,
    marginTop: 16,
    marginBottom: 8,
  },
  proOnlyText: {
    fontSize: 16,
    color: colors.foregroundMuted,
    textAlign: 'center',
    marginBottom: 24,
  },
  upgradeButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: radii.full,
  },
  upgradeButtonText: {
    color: colors.primaryForeground,
    fontSize: 16,
    fontWeight: 'bold',
  },
});

