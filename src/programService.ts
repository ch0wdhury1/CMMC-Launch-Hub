import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "./firebase";

export type ProgramStatus = "active" | "inactive" | "archived";
export type ProgramType = "STATE" | "SPONSOR" | "PARTNER" | "INTERNAL" | "COMMERCIAL";
export type EnrollmentType = "COMMERCIAL" | "PROGRAM";

export type Program = {
  id: string;
  name: string;
  programCode: string;
  programType: ProgramType;
  state?: string;
  sponsorName?: string;
  description?: string;
  status: ProgramStatus;
  allowL1: boolean;
  allowL2: boolean;
  startDate?: string;
  endDate?: string;
  sponsorObserverEmails?: string[];
  sponsorObserverUids?: string[];
  createdAt?: any;
  updatedAt?: any;
  createdBy?: string;
  updatedBy?: string;
};

export type ProgramInput = {
  name: string;
  programCode: string;
  programType: ProgramType;
  state?: string;
  sponsorName?: string;
  description?: string;
  status: ProgramStatus;
  allowL1: boolean;
  allowL2: boolean;
  startDate?: string;
  endDate?: string;
  sponsorObserverEmails?: string[];
  sponsorObserverUids?: string[];
};

export type ProgramWithCounts = Program & {
  participantsCount: number;
  observerCount: number;
};

const programsRef = () => collection(db, "programs");

const cleanList = (items?: string[]) => Array.from(new Set(
  (items || [])
    .map(item => String(item || "").trim())
    .filter(Boolean)
));

const normalizeProgramInput = (input: ProgramInput) => ({
  name: input.name.trim(),
  programCode: input.programCode.trim().toUpperCase(),
  programType: input.programType,
  state: String(input.state || "").trim(),
  sponsorName: String(input.sponsorName || "").trim(),
  description: String(input.description || "").trim(),
  status: input.status,
  allowL1: !!input.allowL1,
  allowL2: !!input.allowL2,
  startDate: String(input.startDate || "").trim(),
  endDate: String(input.endDate || "").trim(),
  sponsorObserverEmails: cleanList(input.sponsorObserverEmails).map(email => email.toLowerCase()),
  sponsorObserverUids: cleanList(input.sponsorObserverUids),
});

async function assertUniqueProgramCode(programCode: string, currentProgramId?: string) {
  const snapshot = await getDocs(query(programsRef(), where("programCode", "==", programCode.trim().toUpperCase())));
  const duplicate = snapshot.docs.find(item => item.id !== currentProgramId);
  if (duplicate) throw new Error(`Program code ${programCode} is already in use.`);
}

export async function createProgram(input: ProgramInput, actorUid?: string): Promise<string> {
  const clean = normalizeProgramInput(input);
  if (!clean.name) throw new Error("Program Name is required.");
  if (!clean.programCode) throw new Error("Program Code is required.");
  if (!clean.programType) throw new Error("Program Type is required.");
  if (!clean.status) throw new Error("Status is required.");
  await assertUniqueProgramCode(clean.programCode);
  const ref = await addDoc(programsRef(), {
    ...clean,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    createdBy: actorUid || "",
    updatedBy: actorUid || "",
  });
  await updateDoc(ref, { id: ref.id });
  return ref.id;
}

export async function updateProgram(programId: string, input: ProgramInput, actorUid?: string): Promise<void> {
  const clean = normalizeProgramInput(input);
  if (!programId) throw new Error("Program id is required.");
  if (!clean.name) throw new Error("Program Name is required.");
  if (!clean.programCode) throw new Error("Program Code is required.");
  if (!clean.programType) throw new Error("Program Type is required.");
  if (!clean.status) throw new Error("Status is required.");
  await assertUniqueProgramCode(clean.programCode, programId);
  await updateDoc(doc(db, "programs", programId), {
    ...clean,
    updatedAt: serverTimestamp(),
    updatedBy: actorUid || "",
  });
}

export async function archiveProgram(programId: string, actorUid?: string): Promise<void> {
  await updateDoc(doc(db, "programs", programId), {
    status: "archived",
    updatedAt: serverTimestamp(),
    updatedBy: actorUid || "",
  });
}

export async function reactivateProgram(programId: string, actorUid?: string): Promise<void> {
  await updateDoc(doc(db, "programs", programId), {
    status: "active",
    updatedAt: serverTimestamp(),
    updatedBy: actorUid || "",
  });
}

export async function getProgram(programId: string): Promise<Program | null> {
  const snapshot = await getDoc(doc(db, "programs", programId));
  return snapshot.exists() ? ({ id: snapshot.id, ...(snapshot.data() as Omit<Program, "id">) }) : null;
}

export async function listPrograms(): Promise<Program[]> {
  const snapshot = await getDocs(query(programsRef(), orderBy("programCode")));
  return snapshot.docs.map(item => ({ id: item.id, ...(item.data() as Omit<Program, "id">) }));
}

export async function getActivePrograms(): Promise<Program[]> {
  const programs = await listPrograms();
  return programs.filter(program => program.status === "active");
}

export async function getProgramParticipantCount(programId: string): Promise<number> {
  const snapshot = await getDocs(query(collection(db, "orgs"), where("programId", "==", programId)));
  return snapshot.size;
}

export function getProgramObserverCount(program: Pick<Program, "sponsorObserverEmails" | "sponsorObserverUids">): number {
  return new Set([...(program.sponsorObserverEmails || []), ...(program.sponsorObserverUids || [])]).size;
}

export async function listProgramsWithCounts(): Promise<ProgramWithCounts[]> {
  const programs = await listPrograms();
  return Promise.all(programs.map(async program => ({
    ...program,
    participantsCount: await getProgramParticipantCount(program.id),
    observerCount: getProgramObserverCount(program),
  })));
}

export function isProgramObserver(user: any): boolean {
  return user?.roles?.pilotObserver === true || user?.roles?.programObserver === true;
}

