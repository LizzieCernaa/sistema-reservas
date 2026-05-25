import { db } from "./config";
  import {
    collection,
    doc,
    setDoc,
    serverTimestamp,
    getDocs,
    query,
    orderBy,
    onSnapshot,
    deleteDoc,
    updateDoc,
  } from "firebase/firestore";

  const RESERVAS_COL = "reservas";

  export async function guardarReserva({
    id,
    name,
    phone,
    mesa,
    combo,
    vipSelections,
  }) {
    const data = {
      id,
      name,
      phone,
      mesa: mesa ? { type: mesa.type, n: mesa.n } : null,
      combo: combo
        ? { id: combo.id, name: combo.name, price: combo.price }
        : null,
      vipSelections: vipSelections
        ? {
            cerveza: vipSelections.cerveza,
            licor: vipSelections.licor,
            soda: vipSelections.soda,
          }
        : null,
      createdAt: serverTimestamp(),
      status: "pending",
    };
    await setDoc(doc(db, RESERVAS_COL, id), data);
    return { id };
  }

  export async function listarReservas() {
    const q = query(collection(db, RESERVAS_COL), orderBy("createdAt", "desc"));
    const snap = await getDocs(q);
    return snap.docs.map((d) => d.data());
  }
  
  export function subscribeToReservas(callback) {
    const q = query(collection(db, RESERVAS_COL), orderBy("createdAt", "desc"));
    return onSnapshot(q, (snap) => {
      callback(snap.docs.map((d) => d.data()));
    });
  }

  export async function actualizarEstadoReserva(id, status) {
    await updateDoc(doc(db, RESERVAS_COL, id), { status });
  }

  export async function borrarReserva(id) {
    await deleteDoc(doc(db, RESERVAS_COL, id));
  }