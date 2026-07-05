import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  FlatList, KeyboardAvoidingView, Platform, ActivityIndicator,
  Alert, Linking, Share
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuthStore } from '../../store/authStore';
import { useThemeStore } from '../../store/themeStore';

import { supabase } from '../../lib/supabase';

const GEMINI_API_KEY = 'AIzaSyDL_XcuNdTqN4_spDJRG2FXCw9g99zsjIY';
const COST_PER_MESSAGE = 1; // 1 credit per AI response

type Message = {
  id: string;
  role: 'user' | 'assistant';
  text: string;
};

const QUICK_ACTIONS = [
  { label: 'Promote Song', prompt: 'Niandikia draft ya ujumbe mzuri wa kutangaza wimbo wangu mpya kwenye Twitter au Instagram. Itengeneze iwe tayari kupostiwa.' },
  { label: 'Write My Bio', prompt: 'Niandikia bio ya kitaalamu kwa ajili ya profile yangu ya muziki. Itumie habari zangu nilizokupa.' },
  { label: 'Gig Pricing', prompt: 'Ningependa kujua bei ya kuimba kwenye show. Nipe bei inayofaa kwa Dar es Salaam, na pia kwa miji mingine ya Tanzania.' },
  { label: 'Grow Fans', prompt: 'Nipe mkakati wa kukuza wafuasi wangu kwenye Bongo Stream na social media. Nipe hatua za vitendo ambazo ninaweza kufanya wiki hii.' },
  { label: 'Find Collab', prompt: 'Nisaidie kupata wasanii wa kufanya kazi nao. Nishauri jinsi ya kuomba ushirikiano na msanii mwingine kwa heshima na kitaalamu.' },
  { label: 'Understand Contract', prompt: 'Nini mambo ya muhimu ninayopaswa kuangalia katika mkataba wa muziki? Nipe orodha ya mambo ya kutizama kabla ya kusaini.' },
];

export default function AIManagerScreen() {
  const { COLORS } = useThemeStore();
  const styles = getStyles(COLORS);
  const router = useRouter();
  const { profile, session, fetchProfile } = useAuthStore();
  const flatListRef = useRef<FlatList>(null);

  const [messages, setMessages] = useState<Message[]>([
    {
      id: '0',
      role: 'assistant',
      text: `Habari ${profile?.display_name || 'Msanii'}!\n\nMimi ni Meneja wako wa kibinafsi. Niko hapa kukusaidia kuendeleza kazi yako ya muziki.\n\nUnaweza kuniuliza kuhusu:\n- Kutangaza muziki wako\n- Bei za maonyesho\n- Kukuza wafuasi\n- Uandishi wa bio na press kit\n- Mikataba ya muziki\n- Na mengi zaidi\n\nUliza swali lolote kwa Kiswahili au Kiingereza.`,
    },
  ]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);

  const isAdmin = profile?.role === 'admin';

  const buildSystemPrompt = () => {
    return `You are a real, veteran, street-smart, and highly successful Tanzanian music manager based in Dar es Salaam. Your name is "Meneja". 

Your management style is a mix of Babu Tale (visionary, street-smart, long-term brand builder) and Sallam SK (strict business, numbers-focused, tough negotiator).
You work exclusively on the Bongo Stream platform. 

CRITICAL RULE: NEVER mention that you are an AI, a language model, a bot, or a virtual assistant. Fully embody the persona of a human music manager who has been in the Tanzanian industry for years. If the artist asks you to do something outside of music management (like coding, math, or general trivia), refuse firmly by saying "Mimi ni meneja wako wa muziki, tuongelee biashara ya muziki. (I am your music manager, let's talk music business)."

ABOUT THE ARTIST YOU ARE MANAGING:
- Name: ${profile?.display_name || 'Unknown'}
- Username: @${profile?.username || 'unknown'}
- Genre: Bongo Flava / Singeli / Afrobeat (Tanzania)
- Followers: ${profile?.follower_count || 0}
- Songs uploaded: ${profile?.track_count || 0}
- Location: ${profile?.location || 'Tanzania'}
- Role: ${profile?.role || 'artist'}
- Account verified: ${profile?.is_verified ? 'Yes' : 'Not yet'}

YOUR EXPERTISE & CONNECTIONS:
- You know every club promoter, radio presenter, and video director in Tanzania (e.g., Hanscana, Director Kenny).
- You have direct lines to Clouds FM, Wasafi FM, TBC, EFM, and East Africa Radio.
- You know the going rates for club shows, stadium shows, and brand deals in Tanzania.

HOW TO RESPOND:
- Use natural Swahili with industry slang (e.g., ngoma, mashabiki, show za mikoani, mkwanja, mchongo, kusua).
- Be street-smart, confident, and strictly professional when money is involved. Act like a strict older brother/sister to the artist.
- Give hard, realistic numbers in TZS. Don't be vague. (e.g., "Kwa level yako sasa, show ya club Dar usichukue chini ya TZS 500,000").
- Be concise — avoid very long replies unless asked. Talk strategy, numbers, and hustle.
- NEVER use emojis in your responses — keep it clean and professional text only.
- Always address the artist by their name: ${profile?.display_name || 'Msanii'}
- Do NOT be a fluffy, overly polite assistant. Be a serious business partner whose only goal is to make the artist famous and rich.

SOCIAL MEDIA POSTING (CRITICAL):
If the artist asks you to write, draft, or create ANY social media post (tweet, instagram caption, whatsapp status), you MUST output the drafted content inside XML tags exactly like this:
<draft platform="twitter">This is the tweet content! #BongoFlava</draft>
The platform MUST be one of: "twitter", "whatsapp", or "instagram". You MUST include these tags so the app can create the Post button. Use emojis ONLY inside the draft tags.

Hustle hard for your artist. Make them money!`;
  };

  const sendMessage = async (text: string) => {
    if (!text.trim()) return;
    if (loading) return;

    // Check credits for non-admins
    if (!isAdmin) {
      const currentCredits = profile?.credits || 0;
      if (currentCredits < COST_PER_MESSAGE) {
        Alert.alert(
          'Hakuna Credits',
          `Unahitaji angalau ${COST_PER_MESSAGE} credit kutuma ujumbe. Nunua credits zaidi!`,
          [
            { text: 'Ghairi', style: 'cancel' },
            { text: 'Nunua Credits', onPress: () => router.push('/buy-credits') }
          ]
        );
        return;
      }
    }

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      text: text.trim(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInputText('');
    setLoading(true);

    // Deduct credit BEFORE calling API (non-admins)
    if (!isAdmin) {
      const { data, error } = await supabase.rpc('deduct_credits', {
        user_id: session?.user.id,
        amount: COST_PER_MESSAGE,
      });
      if (error || !data) {
        setLoading(false);
        Alert.alert('Hitilafu', 'Imeshindwa kukata credit. Jaribu tena.');
        setMessages(prev => prev.filter(m => m.id !== userMessage.id));
        return;
      }
      // Refresh profile to show updated credit count
      fetchProfile();
    }

    // Build conversation history for Gemini
    const conversationHistory = messages.filter(m => m.id !== '0').map(m => ({
      role: m.role === 'user' ? 'user' : 'model',
      parts: [{ text: m.text }],
    }));

    conversationHistory.push({ role: 'user', parts: [{ text: text.trim() }] });

    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            system_instruction: { parts: [{ text: buildSystemPrompt() }] },
            contents: conversationHistory,
            generationConfig: {
              temperature: 0.8,
              maxOutputTokens: 800,
            },
          }),
        }
      );

      const data = await response.json();

      // Show actual API error if request failed
      if (!response.ok) {
        const apiError = data?.error?.message || `HTTP ${response.status}`;
        throw new Error(apiError);
      }

      const aiText = data?.candidates?.[0]?.content?.parts?.[0]?.text;

      if (aiText) {
        const aiMessage: Message = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          text: aiText,
        };
        setMessages(prev => [...prev, aiMessage]);
      } else {
        const blockReason = data?.candidates?.[0]?.finishReason || data?.promptFeedback?.blockReason || 'Unknown';
        throw new Error(`AI haikujibu. Sababu: ${blockReason}`);
      }
    } catch (err: any) {
      Alert.alert('Hitilafu ya AI', err.message || 'Jaribu tena.');
      // Refund credit if API failed
      if (!isAdmin) {
        await supabase.rpc('deduct_credits', { user_id: session?.user.id, amount: -COST_PER_MESSAGE });
        fetchProfile();
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (messages.length > 1) {
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 200);
    }
  }, [messages]);

  const handlePostAction = async (platform: string, content: string) => {
    try {
      if (platform.toLowerCase() === 'twitter') {
        const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(content)}`;
        await Linking.openURL(url);
      } else if (platform.toLowerCase() === 'whatsapp') {
        const url = `whatsapp://send?text=${encodeURIComponent(content)}`;
        const canOpen = await Linking.canOpenURL(url);
        if (canOpen) {
          await Linking.openURL(url);
        } else {
          Alert.alert('Error', 'WhatsApp is not installed.');
        }
      } else {
        // Fallback for Instagram or general sharing
        await Share.share({ message: content });
      }
    } catch (e: any) {
      Alert.alert('Error', 'Could not open sharing app.');
    }
  };

  const renderMessageContent = (text: string) => {
    // Regex to match <draft platform="...">content</draft> (case-insensitive)
    const draftRegex = /<draft[^>]*platform=["']?([^"'>\s]*)["']?[^>]*>([\s\S]*?)<\/draft>/gi;
    
    let parts = [];
    let lastIndex = 0;
    let match;

    while ((match = draftRegex.exec(text)) !== null) {
      // Add text before the draft
      if (match.index > lastIndex) {
        parts.push({ type: 'text', content: text.substring(lastIndex, match.index) });
      }
      // Add the draft card
      parts.push({ type: 'draft', platform: match[1], content: match[2].trim() });
      lastIndex = draftRegex.lastIndex;
    }
    
    // Add remaining text
    if (lastIndex < text.length) {
      parts.push({ type: 'text', content: text.substring(lastIndex) });
    }

    // If no drafts found, just return normal text
    if (parts.length === 0) {
      return <Text style={styles.aiText}>{text}</Text>;
    }

    return (
      <View style={{ gap: 12 }}>
        {parts.map((part, index) => {
          if (part.type === 'text') {
            const cleanText = part.content.trim();
            if (!cleanText) return null;
            return <Text key={index} style={styles.aiText}>{cleanText}</Text>;
          } else {
            return (
              <View key={index} style={styles.draftCard}>
                <View style={styles.draftHeader}>
                  <Ionicons 
                    name={part.platform.toLowerCase() === 'twitter' ? 'logo-twitter' : part.platform.toLowerCase() === 'whatsapp' ? 'logo-whatsapp' : 'share-social'} 
                    size={16} 
                    color={COLORS.gold} 
                  />
                  <Text style={styles.draftPlatform}>
                    Draft: {part.platform.charAt(0).toUpperCase() + part.platform.slice(1)}
                  </Text>
                </View>
                <Text style={styles.draftContent}>{part.content}</Text>
                <TouchableOpacity 
                  style={styles.postButton}
                  onPress={() => handlePostAction(part.platform, part.content)}
                >
                  <Text style={styles.postButtonText}>Post to {part.platform.charAt(0).toUpperCase() + part.platform.slice(1)}</Text>
                  <Ionicons name="send" size={14} color={COLORS.black} />
                </TouchableOpacity>
              </View>
            );
          }
        })}
      </View>
    );
  };

  const renderMessage = ({ item }: { item: Message }) => {
    const isUser = item.role === 'user';
    return (
      <View style={[styles.messageRow, isUser ? styles.userRow : styles.aiRow]}>
        {!isUser && (
          <View style={styles.aiAvatar}>
            <Ionicons name="briefcase" size={16} color={COLORS.gold} />
          </View>
        )}
        <View style={[styles.bubble, isUser ? styles.userBubble : styles.aiBubble]}>
          {isUser ? (
            <Text style={styles.userText}>{item.text}</Text>
          ) : (
            renderMessageContent(item.text)
          )}
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Header */}
      <LinearGradient colors={['#1a1500', COLORS.black]} style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={28} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <View style={styles.headerAvatar}>
            <Ionicons name="briefcase" size={20} color={COLORS.black} />
          </View>
          <View>
            <Text style={styles.headerTitle}>Meneja</Text>
            <Text style={styles.headerSub}>Meneja wako wa kibinafsi</Text>
          </View>
        </View>
        {!isAdmin ? (
          <TouchableOpacity style={styles.creditBadge} onPress={() => router.push('/buy-credits')}>
            <Ionicons name="diamond" size={13} color={(profile?.credits || 0) <= 2 ? COLORS.error : COLORS.gold} />
            <Text style={[styles.creditText, (profile?.credits || 0) <= 2 && { color: COLORS.error }]}>
              {profile?.credits || 0}
            </Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.freeBadge}>
            <Text style={styles.freeText}>FREE</Text>
          </View>
        )}
      </LinearGradient>

      {/* Quick Action Chips */}
      <FlatList
        data={QUICK_ACTIONS}
        horizontal
        showsHorizontalScrollIndicator={false}
        keyExtractor={i => i.label}
        contentContainerStyle={styles.chipsContainer}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.chip}
            onPress={() => sendMessage(item.prompt)}
            disabled={loading}
          >
            <Text style={styles.chipText} numberOfLines={1}>{item.label}</Text>
          </TouchableOpacity>
        )}
        style={styles.chipsRow}
      />

      {/* Messages */}
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={m => m.id}
        renderItem={renderMessage}
        contentContainerStyle={styles.messagesList}
        showsVerticalScrollIndicator={false}
        ListFooterComponent={
          loading ? (
            <View style={styles.typingRow}>
              <View style={styles.aiAvatar}>
                <Ionicons name="briefcase" size={16} color={COLORS.gold} />
              </View>
              <View style={styles.typingBubble}>
                <ActivityIndicator size="small" color={COLORS.gold} />
                <Text style={styles.typingText}>Anafikiri...</Text>
              </View>
            </View>
          ) : null
        }
      />

      {/* Input */}
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={0}>
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            placeholder="Uliza swali lolote..."
            placeholderTextColor={COLORS.textTertiary}
            value={inputText}
            onChangeText={setInputText}
            multiline
            maxLength={500}
          />
          <TouchableOpacity
            style={[styles.sendBtn, (!inputText.trim() || loading) && styles.sendBtnDisabled]}
            onPress={() => sendMessage(inputText)}
            disabled={!inputText.trim() || loading}
          >
            <Ionicons name="send" size={20} color={(!inputText.trim() || loading) ? COLORS.textTertiary : COLORS.black} />
          </TouchableOpacity>
        </View>
        {!isAdmin && (
          <Text style={styles.costNote}>
            Kila ujumbe unagharimu credit 1  |  Umebaki: {profile?.credits || 0}
          </Text>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const getStyles = (COLORS: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.black },

  // Header
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 12, gap: 10 },
  backBtn: { padding: 4 },
  headerCenter: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.gold, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { color: COLORS.textPrimary, fontSize: 16, fontWeight: '800' },
  headerSub: { color: COLORS.textSecondary, fontSize: 11 },
  creditBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.07)', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 14, gap: 4 },
  creditText: { color: COLORS.gold, fontSize: 13, fontWeight: '700' },
  freeBadge: { backgroundColor: 'rgba(212, 175, 55, 0.15)', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 14, borderWidth: 1, borderColor: COLORS.gold },
  freeText: { color: COLORS.gold, fontSize: 11, fontWeight: '900', letterSpacing: 1 },

  // Chips
  chipsRow: { maxHeight: 52, flexGrow: 0 },
  chipsContainer: { paddingHorizontal: 12, paddingVertical: 6, gap: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 9, backgroundColor: 'rgba(212, 175, 55, 0.1)', borderRadius: 20, borderWidth: 1, borderColor: 'rgba(212, 175, 55, 0.3)', flexShrink: 0 },
  chipText: { color: COLORS.gold, fontSize: 12, fontWeight: '600', includeFontPadding: false },

  // Messages
  messagesList: { padding: 16, gap: 12, paddingBottom: 12 },
  messageRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, marginBottom: 10 },
  userRow: { justifyContent: 'flex-end' },
  aiRow: { justifyContent: 'flex-start' },
  aiAvatar: { width: 30, height: 30, borderRadius: 15, backgroundColor: 'rgba(212, 175, 55, 0.15)', borderWidth: 1, borderColor: COLORS.gold, justifyContent: 'center', alignItems: 'center' },
  bubble: { maxWidth: '78%', padding: 12, borderRadius: 18 },
  userBubble: { backgroundColor: COLORS.gold, borderBottomRightRadius: 4 },
  aiBubble: { backgroundColor: 'rgba(255,255,255,0.07)', borderBottomLeftRadius: 4, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  bubbleText: { fontSize: 15, lineHeight: 21 },
  userText: { color: COLORS.black, fontWeight: '500' },
  aiText: { color: '#FFFFFF', fontSize: 15, lineHeight: 22 },
  
  // Draft Card
  draftCard: { backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: 12, padding: 12, marginTop: 4, borderWidth: 1, borderColor: 'rgba(212, 175, 55, 0.2)' },
  draftHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  draftPlatform: { color: COLORS.gold, fontSize: 12, fontWeight: '700', textTransform: 'uppercase' },
  draftContent: { color: '#FFFFFF', fontSize: 14, lineHeight: 20, marginBottom: 12, fontStyle: 'italic' },
  postButton: { backgroundColor: COLORS.gold, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 10, borderRadius: 8, gap: 8 },
  postButtonText: { color: COLORS.black, fontSize: 14, fontWeight: '700' },

  typingRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingTop: 4 },
  typingBubble: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(255,255,255,0.07)', paddingHorizontal: 16, paddingVertical: 12, borderRadius: 18, borderBottomLeftRadius: 4 },
  typingText: { color: COLORS.textSecondary, fontSize: 14 },

  // Input
  inputContainer: { flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: 12, paddingTop: 8, paddingBottom: 8, gap: 10, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)', backgroundColor: COLORS.black },
  input: { flex: 1, backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: 22, paddingHorizontal: 16, paddingVertical: 12, color: COLORS.textPrimary, fontSize: 15, maxHeight: 120, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  sendBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: COLORS.gold, justifyContent: 'center', alignItems: 'center' },
  sendBtnDisabled: { backgroundColor: 'rgba(255,255,255,0.08)' },
  costNote: { color: COLORS.textTertiary, fontSize: 11, textAlign: 'center', paddingBottom: 8 },
});
