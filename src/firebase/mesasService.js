import { db } from "./config";
  import {
    collection,
    doc,
    getDocs,
    onSnapshot,
    runTransaction,
    setDoc,
    deleteDoc,
    writeBatch,
  } from "firebase/firestore";

  const MESAS_COL = "mesas";
  const mesaDocId = (type, n) => `${type}-${n}`;

  // Estado inicial sembrado en Firestore la primera vez que arranca la app.
  // Mesas no existen como documento = disponibles. "D" = no disponible.
  // Cualquier otro string = nombre de quien la reservó.
  export const BASE_G = {
    12: "Jasmin Bermúdez",
    16: "Jessica Torres", 17: "Jessica Torres",
    22: "Jessica Torres", 23: "Jessica Torres",
    29: "Paola Carpio",
    30: "Jessica Torres", 31: "Jessica Torres",
    36: "Jessica Torres", 37: "Jessica Torres",
    38: "Paola Carpio",
    43: "Nahúm Quintanilla",
    47: "Dajhanna García",
    48: "Jennifer Acosta",
    49: "Niña Juanita",
    50: "Berenice Tepas",
    51: "José Flores",
    52: "Adriana Aquino", 53: "Adriana Aquino",
    57: "Elmer Portillo",
  };

  export const BASE_V = {
    1: "Inmer López",
    3: "Andrea Flores",
    4: "Adriana Saracay",
  };

  // Sólo siembra las mesas marcadas como "D" (no disponibles por layout/etc).
  // Las reservas con nombre en BASE_G/BASE_V NO se siembran — quedan disponibles
  // para que la gente las reserve via el flujo normal.
  export async function seedBaseMesasIfEmpty() {
    const snap = await getDocs(collection(db, MESAS_COL));
    if (!snap.empty) return false;
    const batch = writeBatch(db);
    for (const [n, value] of Object.entries(BASE_G)) {
      if (value !== "D") continue;
      batch.set(doc(db, MESAS_COL, mesaDocId("g", n)), {
        type: "g", number: +n, value, seeded: true,
      });
    }
    for (const [n, value] of Object.entries(BASE_V)) {
      if (value !== "D") continue;
      batch.set(doc(db, MESAS_COL, mesaDocId("v", n)), {
        type: "v", number: +n, value, seeded: true,
      });
    }
    await batch.commit();
    return true;
  }

  // Borra TODOS los documentos de la colección "mesas".
  // Después la próxima vez que alguien abra la app, seedBaseMesasIfEmpty
  // vuelve a poner sólo las mesas "D". Sólo para uso del admin.
  export async function borrarTodasLasMesas() {
    const snap = await getDocs(collection(db, MESAS_COL));
    if (snap.empty) return 0;
    const batch = writeBatch(db);
    snap.forEach((d) => batch.delete(d.ref));
    await batch.commit();
    return snap.size;
  }

  export function subscribeToMesas(callback) {
    return onSnapshot(collection(db, MESAS_COL), (snap) => {
      const g = {}, v = {};
      snap.forEach((d) => {
        const data = d.data();
        if (data.type === "g") g[data.number] = data.value;
        else if (data.type === "v") v[data.number] = data.value;
      });
      callback({ g, v });
    });
  }

  // Transacción: si la mesa ya tiene documento, falla.
  // Esto evita doble reserva si dos usuarios la tocan a la vez.
  export async function reservarMesa(type, n, name, reservaId) {
    const ref = doc(db, MESAS_COL, mesaDocId(type, n));
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(ref);
      if (snap.exists()) {
        throw new Error("Esta mesa ya fue reservada por alguien más. Elige otra.");
      }
      tx.set(ref, {
        type,
        number: n,
        value: name,
        reservaId: reservaId || null,
        createdAt: Date.now(),
      });
    });
  }
  // Sólo para el panel de admin.
  export async function liberarMesa(type, n) {
    await deleteDoc(doc(db, MESAS_COL, mesaDocId(type, n)));
  }
