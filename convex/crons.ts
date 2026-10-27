import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Imágenes que ya nadie usa (quitadas, reemplazadas o de productos eliminados para siempre)
crons.daily("limpiar archivos huerfanos", { hourUTC: 7, minuteUTC: 0 }, internal.archivos.limpiarHuerfanos);

export default crons;
