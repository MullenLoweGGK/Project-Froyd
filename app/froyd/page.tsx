import { redirect } from "next/navigation";

/** Legacy microsite path — keep working bookmarks after cutover to `/`. */
export default function FroydRedirectPage() {
  redirect("/");
}
