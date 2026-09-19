import { Ionicons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import {
  Modal,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { colors } from "../constants/colors";
import { getTransactionsByGroupId } from "../database/transactions";
import { styles as menuStyles } from "../styles/menuStyles";
import type { DisplayTransaction, TransactionRow } from "../types";
import { formatCurrency as formatCurrencyDisplay } from "../utils/currency";
import { ConfirmModal } from "./ConfirmModal";

interface SeriesManagerModalProps {
  visible: boolean;
  onClose: () => void;
  transaction: DisplayTransaction | null;
  onDeleteOccurrence: (id: string) => void;
  onDeleteFromHere: (groupId: string, fromId: number) => void;
  onDeleteSeries: (groupId: string) => void;
}

export function SeriesManagerModal({
  visible,
  onClose,
  transaction,
  onDeleteOccurrence,
  onDeleteFromHere,
  onDeleteSeries,
}: SeriesManagerModalProps) {
  const [occurrences, setOccurrences] = useState<TransactionRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [confirmAction, setConfirmAction] = useState<
    "fromHere" | "series" | null
  >(null);

  const groupId = transaction?.recurrenceGroupId;

  // Ao abrir uma série, marca "carregando" já na renderização (sem setState síncrono no effect).
  const loadKey = visible && groupId ? groupId : null;
  const [prevLoadKey, setPrevLoadKey] = useState<typeof loadKey>(null);
  if (loadKey !== prevLoadKey) {
    setPrevLoadKey(loadKey);
    if (loadKey) setIsLoading(true);
  }

  useEffect(() => {
    if (!visible || !groupId) return;
    let cancelled = false;

    getTransactionsByGroupId(groupId)
      .then((rows) => {
        if (!cancelled) setOccurrences(rows);
      })
      .catch((error) => {
        console.log("Erro ao buscar ocorrências da série:", error);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [visible, groupId]);

  if (!transaction || !groupId) return null;

  const isInstallment = transaction.recurrenceType === "installment";
  const currentId = Number(transaction.id);

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={menuStyles.modalContainer}>
        <View style={[menuStyles.modalContent, { maxHeight: "80%" }]}>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 4,
            }}
          >
            <Text style={menuStyles.modalTitle}>
              {isInstallment ? "Compra Parcelada" : "Transação Recorrente"}
            </Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={22} color={colors.textMuted} />
            </TouchableOpacity>
          </View>

          <Text
            style={{
              color: colors.textSecondary,
              fontSize: 13,
              textAlign: "center",
              marginBottom: 16,
            }}
            numberOfLines={1}
          >
            {transaction.description}
          </Text>

          <ScrollView style={{ marginBottom: 16 }}>
            {isLoading ? (
              <Text
                style={{
                  color: colors.textMuted,
                  fontSize: 13,
                  textAlign: "center",
                  paddingVertical: 12,
                }}
              >
                Carregando ocorrências...
              </Text>
            ) : (
              occurrences.map((row, index) => {
                const isCurrent = row.id === currentId;
                return (
                  <View
                    key={row.id}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "space-between",
                      paddingVertical: 10,
                      paddingHorizontal: 12,
                      borderRadius: 10,
                      marginBottom: 6,
                      backgroundColor: isCurrent
                        ? `${colors.accent}26`
                        : colors.surfaceAlt,
                      borderWidth: isCurrent ? 1 : 0,
                      borderColor: colors.accent,
                    }}
                  >
                    <Text
                      style={{
                        color: colors.textPrimary,
                        fontSize: 13,
                        fontWeight: isCurrent ? "bold" : "normal",
                      }}
                    >
                      {isInstallment
                        ? `Parcela ${index + 1}/${occurrences.length}`
                        : `Ocorrência ${index + 1}/${occurrences.length}`}{" "}
                      • {row.date}
                    </Text>
                    <Text
                      style={{
                        color: colors.textPrimary,
                        fontSize: 13,
                        fontWeight: "bold",
                      }}
                    >
                      {formatCurrencyDisplay(row.amount)}
                    </Text>
                  </View>
                );
              })
            )}
          </ScrollView>

          <View style={{ gap: 10 }}>
            <TouchableOpacity
              style={{
                backgroundColor: colors.border,
                padding: 14,
                borderRadius: 12,
                alignItems: "center",
              }}
              onPress={() => {
                onDeleteOccurrence(transaction.id);
                onClose();
              }}
            >
              <Text style={menuStyles.modalButtonText}>
                Excluir somente esta
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={{
                backgroundColor: colors.categoryAmber,
                padding: 14,
                borderRadius: 12,
                alignItems: "center",
              }}
              onPress={() => setConfirmAction("fromHere")}
            >
              <Text style={menuStyles.modalButtonText}>
                Excluir esta e as futuras
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={{
                backgroundColor: colors.expense,
                padding: 14,
                borderRadius: 12,
                alignItems: "center",
              }}
              onPress={() => setConfirmAction("series")}
            >
              <Text style={menuStyles.modalButtonText}>
                Excluir série inteira
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <ConfirmModal
        visible={confirmAction === "fromHere"}
        title="Excluir esta e as futuras"
        message="Isso vai apagar esta ocorrência e todas as que vêm depois dela nesta série. As ocorrências anteriores continuam intactas. Tem certeza?"
        confirmLabel="Excluir"
        destructive
        onCancel={() => setConfirmAction(null)}
        onConfirm={() => {
          setConfirmAction(null);
          onDeleteFromHere(groupId, currentId);
          onClose();
        }}
      />

      <ConfirmModal
        visible={confirmAction === "series"}
        title="Excluir série inteira"
        message={`Isso vai apagar todas as ${occurrences.length || ""} ocorrências desta ${isInstallment ? "compra parcelada" : "transação recorrente"}, incluindo as que já passaram. Essa ação não pode ser desfeita. Tem certeza?`}
        confirmLabel="Excluir tudo"
        destructive
        onCancel={() => setConfirmAction(null)}
        onConfirm={() => {
          setConfirmAction(null);
          onDeleteSeries(groupId);
          onClose();
        }}
      />
    </Modal>
  );
}
