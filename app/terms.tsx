import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { Stack } from 'expo-router';
import { COLORS } from '../constants';

export default function TermsScreen() {
  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: 'Terms & Conditions', headerShown: true, headerStyle: { backgroundColor: COLORS.black }, headerTintColor: COLORS.gold }} />
      <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>Bongo Stream Terms and Conditions</Text>
        <Text style={styles.date}>Last Updated: July 2026</Text>
        
        <Text style={styles.sectionTitle}>1. Acceptance of Terms</Text>
        <Text style={styles.paragraph}>By accessing and using Bongo Stream, you accept and agree to be bound by the terms and provisions of this agreement. In addition, when using these particular services, you shall be subject to any posted guidelines or rules applicable to such services.</Text>
        
        <Text style={styles.sectionTitle}>2. User Accounts</Text>
        <Text style={styles.paragraph}>To use certain features of the app, you must register for an account. You agree to provide accurate, current, and complete information during the registration process and update such information to keep it accurate, current, and complete.</Text>
        
        <Text style={styles.sectionTitle}>3. AI Studio & Llama 3 Integration</Text>
        <Text style={styles.paragraph}>Bongo Stream provides an "AI Studio" feature powered by Meta's Llama 3 (via Groq). By using this feature, you agree that lyrics generated are for your personal use. You are responsible for ensuring the generated content does not violate any third-party rights.</Text>

        <Text style={styles.sectionTitle}>4. In-App Credits</Text>
        <Text style={styles.paragraph}>Certain features, such as the AI Studio, require in-app credits. Credits can be purchased via ClickPesa. All purchases are final and non-refundable. Bongo Stream reserves the right to modify the cost of AI generations at any time.</Text>

        <Text style={styles.sectionTitle}>5. Artist Upgrades & Content Rights</Text>
        <Text style={styles.paragraph}>Any user may choose to upgrade their account to an "Artist" profile. By upgrading and publishing tracks, you represent and warrant that you own or have the necessary licenses, rights, and permissions to publish the audio files you upload. You maintain full control over your content and may permanently delete your published songs at any time.</Text>

        <Text style={styles.sectionTitle}>6. Acceptable Use</Text>
        <Text style={styles.paragraph}>You agree not to use the app to upload, post, or otherwise transmit any content that violates or infringes in any way upon the rights of others, or that is unlawful, threatening, abusive, defamatory, invasive of privacy or publicity rights, vulgar, obscene, profane or otherwise objectionable.</Text>

        <Text style={styles.sectionTitle}>7. Support Tickets & Administration</Text>
        <Text style={styles.paragraph}>Bongo Stream provides an in-app Support Ticket system. By submitting a ticket, you grant our administrative team the right to review your account data to resolve your issue. We strive to resolve all complaints promptly.</Text>

        <Text style={styles.sectionTitle}>8. Modifications to Service</Text>
        <Text style={styles.paragraph}>Bongo Stream reserves the right at any time and from time to time to modify or discontinue, temporarily or permanently, the Service (or any part thereof) with or without notice.</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.black },
  content: { padding: 16 },
  title: { color: COLORS.gold, fontSize: 22, fontWeight: 'bold', marginBottom: 4 },
  date: { color: COLORS.textTertiary, fontSize: 13, marginBottom: 24 },
  sectionTitle: { color: COLORS.textPrimary, fontSize: 16, fontWeight: '700', marginTop: 16, marginBottom: 8 },
  paragraph: { color: COLORS.textSecondary, fontSize: 14, lineHeight: 22 }
});
