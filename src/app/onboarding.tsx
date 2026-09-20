import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { useEffect, useState, type ComponentProps } from "react";
import { BackHandler, Image, ScrollView, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { CustomAlert } from "../components/CustomAlert";
import { DebtModal } from "../components/DebtModal";
import { OnboardingInstallmentModal } from "../components/OnboardingInstallmentModal";
import { OnboardingRecurringModal } from "../components/OnboardingRecurringModal";
import { createDebt } from "../database/debts";
import {
  createRecurringOnDay,
  createRemainingInstallments,
} from "../database/transactions";
import { getUser, updateUserAvatar } from "../database/users";
import { markReleaseNotesSeen } from "../hooks/useReleaseNotes";
import { useIndexStyles } from "../styles/indexStyles";
import type { DebtDraft, InstallmentDraft, RecurringDraft } from "../types";
import { formatCurrency, formatCurrencyInput } from "../utils/currency";
import { formatDateToString } from "../utils/dates";
import { logError } from "../utils/logger";
import { Text, useTheme } from "../theme";

type IconName = ComponentProps<typeof Ionicons>["name"];

const RECURRING_MONTHS = 12;

type StepKey = "photo" | "recurring" | "installments" | "debts";

const STEPS: {
  key: StepKey;
  icon: IconName;
  title: string;
  question: string;
  hint: string;
  addLabel: string;
}[] = [
  {
    key: "photo",
    icon: "person-circle-outline",
    title: "Foto de perfil",
    question: "Quer colocar uma foto no seu perfil?",
    hint: "Ela aparece no topo do app. Você pode trocar depois, no menu do perfil.",
    addLabel: "Escolher foto da galeria",
  },
  {
    key: "recurring",
    icon: "repeat-outline",
    title: "Contas e receitas fixas",
    question: "Você tem alguma receita ou despesa que se repete todo mês?",
    hint: `Ex: salário, aluguel, internet, assinaturas. Elas já entram nos próximos ${RECURRING_MONTHS} meses.`,
    addLabel: "Adicionar receita/despesa fixa",
  },
  {
    key: "installments",
    icon: "card-outline",
    title: "Compras parceladas",
    question: "Você tem compras parceladas em andamento?",
    hint: "Ex: celular em 10x, sofá em 6x. Lançamos só as parcelas que ainda faltam.",
    addLabel: "Adicionar compra parcelada",
  },
  {
    key: "debts",
    icon: "people-outline",
    title: "Dívidas e empréstimos",
    question: "Você deve dinheiro a alguém, ou alguém te deve?",
    hint: "Ficam separados do seu saldo até serem quitados.",
    addLabel: "Adicionar dívida ou empréstimo",
  },
];

interface EntryRowProps {
  icon: IconName;
  color: string;
  title: string;
  subtitle: string;
  amountText: string;
  onRemove: () => void;
}

function EntryRow({
  icon,
  color,
  title,
  subtitle,
  amountText,
  onRemove,
}: EntryRowProps) {
  const { colors } = useTheme();
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.surfaceAlt,
        borderRadius: 12,
        padding: 14,
        marginBottom: 10,
      }}
    >
      <View
        style={{
          width: 40,
          height: 40,
          borderRadius: 20,
          backgroundColor: `${color}26`,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Ionicons name={icon} size={20} color={color} />
      </View>

      <View style={{ flex: 1 }}>
        <Text
          style={{ color: colors.textPrimary, fontSize: 15, fontWeight: "600" }}
          numberOfLines={1}
        >
          {title}
        </Text>
        <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 2 }}>
          {subtitle}
        </Text>
      </View>

      <Text style={{ color, fontSize: 14, fontWeight: "bold" }}>
        {amountText}
      </Text>

      <TouchableOpacity onPress={onRemove} hitSlop={8}>
        <Ionicons name="close-circle" size={20} color={colors.textMuted} />
      </TouchableOpacity>
    </View>
  );
}

const newId = () =>
  `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

export default function OnboardingScreen() {
  const { colors } = useTheme();
  const indexStyles = useIndexStyles();
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [userName, setUserName] = useState("");
  const [recurring, setRecurring] = useState<RecurringDraft[]>([]);
  const [installments, setInstallments] = useState<InstallmentDraft[]>([]);
  const [debts, setDebts] = useState<DebtDraft[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [alertState, setAlertState] = useState<{
    title: string;
    message: string;
  } | null>(null);

  useEffect(() => {
    getUser()
      .then((user) => setUserName(user?.name ?? ""))
      .catch((error) => logError("Erro ao buscar usuário:", error));
  }, []);

  // O botão voltar do Android volta um passo em vez de fechar o app.
  useEffect(() => {
    const subscription = BackHandler.addEventListener(
      "hardwareBackPress",
      () => {
        if (step > 0) {
          setStep(step - 1);
          return true;
        }
        return false;
      },
    );
    return () => subscription.remove();
  }, [step]);

  const totalAdded =
    (avatarUri ? 1 : 0) + recurring.length + installments.length + debts.length;
  const isLastStep = step === STEPS.length - 1;
  const currentStep = STEPS[step];
  const stepKey = currentStep.key;

  const pickImage = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setAlertState({
        title: "Permissão negada",
        message: "Precisamos de acesso à galeria para escolher sua foto.",
      });
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0].uri) {
      setAvatarUri(result.assets[0].uri);
    }
  };

  const goToDashboard = () => router.replace("/dashboard");

  const handleFinish = async () => {
    setIsSaving(true);
    try {
      if (avatarUri) {
        await updateUserAvatar(avatarUri, userName || "Meu Finanças");
      }

      for (const item of recurring) {
        await createRecurringOnDay(
          {
            amount: item.amount,
            description: item.title,
            type: item.type,
            category: item.category,
          },
          item.day,
          RECURRING_MONTHS,
        );
      }

      for (const item of installments) {
        await createRemainingInstallments(
          {
            amount: item.installmentAmount,
            date: item.firstDate,
            description: item.title,
            type: "expense",
            category: item.category,
          },
          item.startNumber,
          item.total,
        );
      }

      const today = formatDateToString(new Date());
      for (const item of debts) {
        await createDebt({
          person: item.person,
          amount: item.amount,
          type: item.type,
          description: item.description,
          date: today,
          dueDate: item.dueDate,
        });
      }

      // Instalação nova não precisa ver o que mudou em atualizações anteriores.
      await markReleaseNotesSeen().catch(() => {});
      goToDashboard();
    } catch (error) {
      logError("Erro ao salvar o pré-cadastro:", error);
      setAlertState({
        title: "Erro",
        message:
          "Não foi possível salvar algumas informações. Tente concluir novamente.",
      });
      setIsSaving(false);
    }
  };

  const handleNext = () => {
    if (isLastStep) {
      handleFinish();
    } else {
      setStep(step + 1);
    }
  };

  const entries: (EntryRowProps & { id: string })[] =
    stepKey === "recurring"
      ? recurring.map((item) => ({
          id: item.id,
          icon: item.type === "income" ? "arrow-down-outline" : "arrow-up-outline",
          color: item.type === "income" ? colors.income : colors.expense,
          title: item.title,
          subtitle: `Todo dia ${item.day} • ${item.category}`,
          amountText: formatCurrency(item.amount),
          onRemove: () =>
            setRecurring((prev) => prev.filter((r) => r.id !== item.id)),
        }))
      : stepKey === "installments"
        ? installments.map((item) => {
            const remaining = item.total - item.startNumber + 1;
            return {
              id: item.id,
              icon: "card-outline" as IconName,
              color: colors.expense,
              title: item.title,
              subtitle: `${remaining} ${remaining === 1 ? "parcela restante" : "parcelas restantes"} • próxima em ${item.firstDate}`,
              amountText: `${formatCurrency(item.installmentAmount)}/mês`,
              onRemove: () =>
                setInstallments((prev) => prev.filter((i) => i.id !== item.id)),
            };
          })
        : stepKey === "debts"
          ? debts.map((item) => ({
            id: item.id,
            icon: (item.type === "lent"
              ? "arrow-down-outline"
              : "arrow-up-outline") as IconName,
            color: item.type === "lent" ? colors.income : colors.expense,
            title: item.person,
            subtitle: `${item.type === "lent" ? "Te deve" : "Você deve"}${item.dueDate ? ` • até ${item.dueDate}` : ""}`,
            amountText: formatCurrency(item.amount),
            onRemove: () =>
              setDebts((prev) => prev.filter((d) => d.id !== item.id)),
          }))
          : [];

  const primaryLabel = isSaving
    ? "Salvando..."
    : isLastStep
      ? "Concluir"
      : stepKey === "photo"
        ? avatarUri
          ? "Próximo"
          : "Agora não, próximo"
        : entries.length === 0
          ? "Não tenho, próximo"
          : "Próximo";

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 16,
          paddingHorizontal: 24,
          paddingTop: 12,
        }}
      >
        <View style={{ flex: 1, flexDirection: "row", gap: 6 }}>
          {STEPS.map((_, index) => (
            <View
              key={index}
              style={{
                flex: 1,
                height: 4,
                borderRadius: 2,
                backgroundColor:
                  index <= step ? colors.income : colors.surfaceAlt,
              }}
            />
          ))}
        </View>

        {totalAdded === 0 && !isSaving ? (
          <TouchableOpacity onPress={goToDashboard} hitSlop={8}>
            <Text style={{ color: colors.textMuted, fontWeight: "600" }}>
              Pular
            </Text>
          </TouchableOpacity>
        ) : null}
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 24, paddingBottom: 12 }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={{ alignItems: "center", marginBottom: 28 }}>
          {stepKey === "photo" ? (
            <View
              style={{
                width: 112,
                height: 112,
                borderRadius: 56,
                backgroundColor: colors.surfaceAlt,
                borderWidth: 2,
                borderColor: avatarUri ? colors.accent : colors.borderSubtle,
                alignItems: "center",
                justifyContent: "center",
                overflow: "hidden",
                marginBottom: 16,
              }}
            >
              {avatarUri ? (
                <Image
                  source={{ uri: avatarUri }}
                  style={{ width: "100%", height: "100%" }}
                />
              ) : (
                <Ionicons name="person" size={48} color={colors.textMuted} />
              )}
            </View>
          ) : (
            <View
              style={{
                width: 64,
                height: 64,
                borderRadius: 32,
                backgroundColor: `${colors.income}1A`,
                alignItems: "center",
                justifyContent: "center",
                marginBottom: 16,
              }}
            >
              <Ionicons name={currentStep.icon} size={30} color={colors.income} />
            </View>
          )}

          {step === 0 && userName ? (
            <Text style={{ color: colors.textSecondary, fontSize: 14, marginBottom: 6 }}>
              Vamos deixar tudo pronto, {userName}
            </Text>
          ) : null}

          <Text
            style={{
              color: colors.textMuted,
              fontSize: 11,
              fontWeight: "bold",
              letterSpacing: 1,
              marginBottom: 6,
            }}
          >
            PASSO {step + 1} DE {STEPS.length}
          </Text>
          <Text
            style={{
              color: colors.textPrimary,
              fontSize: 22,
              fontWeight: "bold",
              textAlign: "center",
              marginBottom: 10,
            }}
          >
            {currentStep.title}
          </Text>
          <Text
            style={{
              color: colors.textPrimary,
              fontSize: 15,
              textAlign: "center",
              marginBottom: 8,
            }}
          >
            {currentStep.question}
          </Text>
          <Text
            style={{
              color: colors.textMuted,
              fontSize: 13,
              lineHeight: 19,
              textAlign: "center",
            }}
          >
            {currentStep.hint}
          </Text>
        </View>

        {entries.map(({ id, ...row }) => (
          <EntryRow key={id} {...row} />
        ))}

        {stepKey === "photo" && avatarUri ? (
          <TouchableOpacity
            onPress={() => setAvatarUri(null)}
            style={{ alignItems: "center", marginBottom: 14 }}
            hitSlop={8}
          >
            <Text style={{ color: colors.expense, fontSize: 13, fontWeight: "600" }}>
              Remover foto
            </Text>
          </TouchableOpacity>
        ) : null}

        <TouchableOpacity
          onPress={stepKey === "photo" ? pickImage : () => setIsModalOpen(true)}
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            paddingVertical: 16,
            borderWidth: 1,
            borderColor: colors.borderSubtle,
            borderStyle: "dashed",
            borderRadius: 12,
          }}
        >
          <Ionicons
            name={stepKey === "photo" ? "image-outline" : "add-circle-outline"}
            size={20}
            color={colors.textPrimary}
          />
          <Text style={{ color: colors.textPrimary, fontWeight: "bold", fontSize: 14 }}>
            {stepKey === "photo" && avatarUri
              ? "Escolher outra foto"
              : currentStep.addLabel}
          </Text>
        </TouchableOpacity>
      </ScrollView>

      <View style={{ flexDirection: "row", gap: 12, padding: 24, paddingTop: 12 }}>
        {step > 0 ? (
          <TouchableOpacity
            onPress={() => setStep(step - 1)}
            disabled={isSaving}
            style={[
              indexStyles.button,
              { flex: 1, borderColor: colors.borderSubtle },
            ]}
          >
            <Text style={[indexStyles.buttonText, { color: colors.textSecondary }]}>
              Voltar
            </Text>
          </TouchableOpacity>
        ) : null}

        <TouchableOpacity
          onPress={handleNext}
          disabled={isSaving}
          style={[indexStyles.button, { flex: 2, opacity: isSaving ? 0.6 : 1 }]}
        >
          <Text style={indexStyles.buttonText}>{primaryLabel}</Text>
        </TouchableOpacity>
      </View>

      <OnboardingRecurringModal
        visible={isModalOpen && stepKey === "recurring"}
        onClose={() => setIsModalOpen(false)}
        formatCurrency={formatCurrencyInput}
        months={RECURRING_MONTHS}
        onSave={(draft) => {
          setRecurring((prev) => [...prev, { id: newId(), ...draft }]);
          setIsModalOpen(false);
        }}
      />

      <OnboardingInstallmentModal
        visible={isModalOpen && stepKey === "installments"}
        onClose={() => setIsModalOpen(false)}
        formatCurrency={formatCurrencyInput}
        onSave={(draft) => {
          setInstallments((prev) => [...prev, { id: newId(), ...draft }]);
          setIsModalOpen(false);
        }}
      />

      <DebtModal
        visible={isModalOpen && stepKey === "debts"}
        onClose={() => setIsModalOpen(false)}
        formatCurrency={formatCurrencyInput}
        onSave={(data) => {
          setDebts((prev) => [...prev, { id: newId(), ...data }]);
          setIsModalOpen(false);
        }}
      />

      <CustomAlert
        visible={alertState !== null}
        title={alertState?.title ?? ""}
        message={alertState?.message ?? ""}
        onClose={() => setAlertState(null)}
      />
    </SafeAreaView>
  );
}
