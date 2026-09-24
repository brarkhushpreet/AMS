"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Papa from "papaparse";
import { toast } from "sonner";
import {
  CheckCircle2,
  Download,
  FileSpreadsheet,
  LoaderCircle,
  UploadCloud,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";

type RosterRow = {
  name: string;
  email: string;
  registrationNumber: string;
  department: string;
  className: string;
  batch: string;
};

const aliases: Record<string, keyof RosterRow> = {
  name: "name",
  studentname: "name",
  fullname: "name",
  email: "email",
  emailaddress: "email",
  registrationnumber: "registrationNumber",
  registrationno: "registrationNumber",
  regno: "registrationNumber",
  department: "department",
  branch: "department",
  class: "className",
  classname: "className",
  batch: "batch",
};

function normalizedKey(key: string) {
  return key.toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function RosterImport({ classroomId }: { classroomId: string }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<RosterRow[]>([]);
  const [fileName, setFileName] = useState("");
  const [error, setError] = useState("");
  const [result, setResult] = useState("");
  const [pending, setPending] = useState(false);

  function parse(file: File) {
    setError("");
    setResult("");
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: ({ data, errors }) => {
        if (errors.length > 0) {
          setError(errors[0].message);
          toast.error("CSV could not be read", {
            description: errors[0].message,
          });
          return;
        }
        const mapped = data.map((source) => {
          const row: RosterRow = {
            name: "",
            email: "",
            registrationNumber: "",
            department: "",
            className: "",
            batch: "",
          };
          Object.entries(source).forEach(([key, value]) => {
            const destination = aliases[normalizedKey(key)];
            if (destination) row[destination] = String(value ?? "").trim();
          });
          return row;
        });
        const valid = mapped.filter((row) => row.name || row.email);
        if (valid.length === 0) {
          const message = "No student rows were found. Use the template columns.";
          setError(message);
          toast.error("No valid students found", { description: message });
          return;
        }
        setRows(valid.slice(0, 500));
        setFileName(file.name);
        toast.info("Roster ready to review", {
          description: `${valid.slice(0, 500).length} rows were found in ${file.name}.`,
        });
      },
    });
  }

  async function upload() {
    setPending(true);
    setError("");
    const response = await fetch(`/api/classrooms/${classroomId}/import`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ rows }),
    });
    const payload = await response.json();
    setPending(false);
    if (!response.ok) {
      const message = payload.error ?? "The roster could not be imported.";
      setError(message);
      toast.error("Roster import failed", { description: message });
      return;
    }
    setResult(
      `${payload.enrolled} existing student${payload.enrolled === 1 ? "" : "s"} enrolled · ${payload.invited} invitation${payload.invited === 1 ? "" : "s"} prepared${payload.rejected.length ? ` · ${payload.rejected.length} rejected` : ""}`,
    );
    setRows([]);
    setFileName("");
    toast.success("Roster imported", {
      description: `${payload.enrolled} enrolled · ${payload.invited} invited`,
    });
    router.refresh();
  }

  function downloadTemplate() {
    const csv =
      "name,email,registrationNumber,department,class,batch\nAarav Sharma,aarav@example.edu,2026-CS-014,Computer Science,B.Tech CSE,2026-2030\n";
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "classpulse-roster-template.csv";
    anchor.click();
    URL.revokeObjectURL(url);
    toast.success("Template downloaded");
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="grid size-10 place-items-center rounded-xl bg-emerald-50 text-emerald-600">
            <FileSpreadsheet className="size-4.5" />
          </span>
          <div>
            <h3 className="font-semibold text-slate-950">Import roster</h3>
            <p className="mt-1 text-xs font-semibold text-slate-500">
              CSV · up to 500 students · invitations expire in 30 days
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={downloadTemplate}
          className="inline-flex items-center gap-2 text-xs font-semibold text-brand-600 hover:text-brand-700"
        >
          <Download className="size-3.5" />
          Template
        </button>
      </div>

      {error && (
        <p role="alert" className="mt-4 rounded-xl bg-red-50 px-3 py-2.5 text-xs font-bold text-red-700">
          {error}
        </p>
      )}
      {result && (
        <p className="mt-4 flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2.5 text-xs font-bold text-emerald-700">
          <CheckCircle2 className="size-4" />
          {result}
        </p>
      )}

      {rows.length === 0 ? (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="mt-5 flex w-full flex-col items-center rounded-xl border border-dashed border-slate-300 bg-slate-50/60 px-5 py-7 text-center hover:border-blue-300 hover:bg-blue-50/40"
        >
          <UploadCloud className="size-6 text-blue-500" />
          <span className="mt-3 text-sm font-semibold text-slate-700">
            Choose your roster CSV
          </span>
          <span className="mt-1 text-xs font-semibold text-slate-500">
            name, email, registrationNumber, department, class, batch
          </span>
        </button>
      ) : (
        <div className="mt-5">
          <div className="mb-3 flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2">
            <div className="min-w-0">
              <p className="truncate text-xs font-semibold text-slate-700">{fileName}</p>
              <p className="text-[0.65rem] font-semibold text-slate-500">
                {rows.length} row{rows.length === 1 ? "" : "s"} ready
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setRows([]);
                setFileName("");
              }}
              className="grid size-8 place-items-center rounded-lg text-slate-500 hover:bg-white hover:text-red-500"
              aria-label="Remove file"
            >
              <X className="size-4" />
            </button>
          </div>
          <div className="no-scrollbar overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full min-w-[34rem] text-left text-xs">
              <thead className="bg-slate-50 text-[0.65rem] tracking-wide text-slate-500 uppercase">
                <tr>
                  <th className="px-3 py-2.5">Name</th>
                  <th className="px-3 py-2.5">Email</th>
                  <th className="px-3 py-2.5">Registration</th>
                  <th className="px-3 py-2.5">Class / batch</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.slice(0, 5).map((row, index) => (
                  <tr key={`${row.email}-${index}`}>
                    <td className="px-3 py-2.5 font-bold text-slate-700">{row.name || "—"}</td>
                    <td className="px-3 py-2.5 text-slate-500">{row.email || "—"}</td>
                    <td className="px-3 py-2.5 text-slate-500">{row.registrationNumber || "—"}</td>
                    <td className="px-3 py-2.5 text-slate-500">
                      {[row.className, row.batch].filter(Boolean).join(" · ") || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {rows.length > 5 && (
            <p className="mt-2 text-center text-[0.65rem] font-semibold text-slate-500">
              + {rows.length - 5} more rows
            </p>
          )}
          <Button type="button" variant="brand" className="mt-4 w-full" onClick={upload} disabled={pending}>
            {pending ? <LoaderCircle className="size-4 animate-spin" /> : <UploadCloud className="size-4" />}
            {pending ? "Importing…" : `Import ${rows.length} students`}
          </Button>
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept=".csv,text/csv"
        className="sr-only"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) parse(file);
        }}
      />
    </div>
  );
}
