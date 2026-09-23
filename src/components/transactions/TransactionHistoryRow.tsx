import { Ionicons } from "@expo/vector-icons";
import { TouchableOpacity, View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";

import type { DisplayTransaction } from "../../types";
import { formatCurrency } from "../../utils/currency";
import { Text, useTheme } from "../../theme";

interface TransactionHistoryRowProps {
  item: DisplayTransaction;
  /** Atraso (ms) da animação de entrada da linha, já capado pra não atrasar demais nas linhas mais abaixo. */
  animationDelay: number;
  onEdit: (item: DisplayTransaction) => void;
  onDelete: (id: string) => void;
  /** Apaga as duas pontas de uma transferência entre contas de uma vez. */
  onDeleteTransferGroup: (transferGroupId: string) => void;
  onOpenSeries: (item: DisplayTransaction) => void;
}

/** Uma linha do histórico de transações: ícone, título, valor, data/conta e as ações (editar/apagar/série). */
export function TransactionHistoryRow({
  item,
  animationDelay,
  onEdit,
  onDelete,
  onDeleteTransferGroup,
  onOpenSeries,
}: TransactionHistoryRowProps) {
  const { colors } = useTheme();
  return (
    <Animated.View
      entering={FadeIn.duration(250).delay(animationDelay)}
      style={{
        backgroundColor: colors.surface,
        padding: 14,
        borderRadius: 12,
        marginBottom: 10,
        borderWidth: 1,
        borderColor: colors.surfaceAlt,
      }}
    >
      {/* Linha 1: ícone, título e valor — título tem toda a largura livre. */}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        <View
          style={{
            width: 40,
            height: 40,
            borderRadius: 20,
            // Fundo translúcido na cor da categoria (não só receita/despesa),
            // pra transações de categorias diferentes serem visualmente distintas.
            backgroundColor: `${item.color}26`,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Ionicons
            name={
              item.transferGroupId
                ? "swap-horizontal-outline"
                : item.type === "income"
                  ? "arrow-down-outline"
                  : "arrow-up-outline"
            }
            size={20}
            color={item.color}
          />
        </View>

        <Text
          style={{
            flex: 1,
            color: colors.textPrimary,
            fontSize: 16,
            fontWeight: "500",
          }}
          numberOfLines={1}
        >
          {item.description}
        </Text>

        <Text
          style={{
            color: item.type === "income" ? colors.income : colors.expense,
            fontSize: 14,
            fontWeight: "bold",
          }}
        >
          {formatCurrency(item.amount, {
            forceSign: item.type === "income" ? "+" : "-",
          })}
        </Text>
      </View>

      {/* Linha 2: data e ações — fora da disputa de espaço com o título. */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          marginTop: 10,
          paddingLeft: 52,
        }}
      >
        <Text
          style={{ color: colors.textMuted, fontSize: 12, flexShrink: 1 }}
          numberOfLines={1}
        >
          {item.account ? `${item.date} · ${item.account}` : item.date}
        </Text>

        <View style={{ flexDirection: "row", gap: 8 }}>
          {/* Transferência não tem edição própria (mexeria só numa das pontas): só dá para apagar as duas juntas. */}
          {!item.transferGroupId && (
            <TouchableOpacity
              onPress={() => onEdit(item)}
              style={{
                backgroundColor: colors.surfaceAlt,
                borderWidth: 1,
                borderColor: colors.textPrimary,
                borderRadius: 8,
                width: 34,
                height: 34,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Ionicons name="pencil-outline" size={16} color={colors.textPrimary} />
            </TouchableOpacity>
          )}

          <TouchableOpacity
            onPress={() =>
              item.transferGroupId
                ? onDeleteTransferGroup(item.transferGroupId)
                : onDelete(item.id)
            }
            style={{
              backgroundColor: colors.surfaceAlt,
              borderWidth: 1,
              borderColor: colors.textPrimary,
              borderRadius: 8,
              width: 34,
              height: 34,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Ionicons name="trash-outline" size={16} color={colors.expense} />
          </TouchableOpacity>

          {item.recurrenceType && (
            <TouchableOpacity
              onPress={() => onOpenSeries(item)}
              style={{
                backgroundColor: colors.surfaceAlt,
                borderWidth: 1,
                borderColor: colors.textPrimary,
                borderRadius: 8,
                width: 34,
                height: 34,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Ionicons name="repeat-outline" size={16} color={colors.accent} />
            </TouchableOpacity>
          )}
        </View>
      </View>
    </Animated.View>
  );
}
