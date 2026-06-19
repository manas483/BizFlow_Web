/**
 * Disposable & temporary email domain blocklist.
 * Updated: 2026-05. Add new domains as needed.
 */
export const DISPOSABLE_EMAIL_DOMAINS = new Set([
  // ── Mailinator family ──
  "mailinator.com", "mailinator2.com", "mailinator.net",
  "trashmail.com", "trashmail.at", "trashmail.io", "trashmail.me",
  "trashmail.net", "trashmail.org", "trashmail.xyz",
  // ── Guerrilla Mail ──
  "guerrillamail.com", "guerrillamail.info", "guerrillamail.biz",
  "guerrillamail.de", "guerrillamail.net", "guerrillamail.org",
  "guerrillamailblock.com", "spam4.me",
  // ── 10 Minute Mail / Temp Mail services ──
  "10minutemail.com", "10minutemail.net", "10minutemail.org",
  "tempmail.com", "temp-mail.org", "temp-mail.io", "temp-mail.net",
  "tempr.email", "dispostable.com",
  "fakeinbox.com", "fakeinbox.net",
  "maildrop.cc", "throwam.com",
  "yopmail.com", "yopmail.fr", "cool.fr.nf", "jetable.fr.nf",
  "nospam.ze.tc", "nomail.xl.cx", "mega.zik.dj", "speed.1s.fr",
  "courriel.fr.nf", "moncourrier.fr.nf", "monemail.fr.nf",
  // ── Sharklasers / Guerrilla sub-domains ──
  "sharklasers.com", "guerrillamailblock.com", "grr.la",
  "guerrillamail.info", "spam4.me",
  // ── Throwaway ──
  "throwaway.email", "spamgourmet.com", "spamgourmet.net",
  "spamgourmet.org", "spamgourmet.com", "discard.email",
  "deadaddress.com", "dead.email",
  // ── Mailnull / Spambox ──
  "mailnull.com", "spambox.us", "mailexpire.com",
  "filzmail.com", "throwam.com", "discardmail.com",
  "discardmail.de", "spamspot.com",
  // ── Crap Mail ──
  "crap.la", "uggsoutlet.us", "objectmail.com",
  // ── Owlpic / Nwldx / similar ──
  "owlpic.com", "nwldx.com", "sogetthis.com",
  // ── Getairmail ──
  "getairmail.com", "getairmail.cf",
  // ── Mailnesia ──
  "mailnesia.com",
  // ── Spamfree ──
  "spamfree24.org", "spamfree24.de", "spamfree24.eu",
  "spamfree24.info", "spamfree24.biz", "spamfree24.net",
  // ── Misc one-click temp services ──
  "mytrashmail.com", "dispostable.com", "throwam.com",
  "emailtemporanea.com", "emailtemporanea.net",
  "mt2015.com", "mt2014.com",
  "mt2016.com", "mt2017.com",
  "tempemail.net", "tempemail.co", "tempemail.com",
  "throwam.com", "spamherelots.com", "spamhereplease.com",
  "herewego.maileater.com", "spam.la",
  "spamthis.co.uk", "nobulk.com", "nospamfor.us",
  "nospamthanks.info", "spammotel.com",
  // ── Jetable ──
  "jetable.com", "jetable.net", "jetable.org", "jetable.fr.nf",
  // ── Gish.pl / similar EU throwaway ──
  "gishpuppy.com", "baxomale.ht.cx",
  // ── Spamgob ──
  "spamgob.com",
  // ── Bugmenot ──
  "bugmenot.com",
  // ── Other popular temp-mail services ──
  "mohmal.com", "emkei.cz", "getnada.com", "harakirimail.com",
  "imgof.com", "jnxjn.com", "jourrapide.com", "kasmail.com",
  "klassmaster.com", "klassmaster.net", "lol.ovpn.to",
  "maildea.com", "mailme.lv", "mailme.ir",
  "mailmetrash.com", "mailmoth.com", "mailnew.com",
  "mailscrap.com", "mailshell.com", "mailsiphon.com",
  "mailslite.com", "mailzilla.com", "mailzilla.org",
  "meinspamschutz.de", "meltmail.com", "mierdamail.com",
  "mintemail.com", "moncourrier.fr.nf", "monemail.fr.nf",
  "monumentmail.com", "mox.pp.ua", "mt2015.com",
  "myspamless.com", "nospam.ze.tc", "nospam4.us",
  "notsharingmy.info", "nowmymail.com",
  "obobbo.com", "oneoffmail.com", "opayq.com",
  "ordinaryamerican.net", "pookmail.com", "proxymail.eu",
  "prtnx.com", "putthisinyourspamdatabase.com",
  "qq.com.s3-website-us-east-1.amazonaws.com",
  "rcpt.at", "reallymymail.com", "recode.me",
  "rppkn.com", "safetymail.info", "safetypost.de",
  "sandelf.de", "sendfree.org", "sendspamhere.com",
  "sharklasers.com", "shieldedmail.com", "skunks.at",
  "slaskpost.se", "slopsbox.com", "smellfear.com",
  "snkmail.com", "sofort-mail.de", "sogetthis.com",
  "spam.su", "spamavert.com", "spambox.me",
  "spamcannon.com", "spamcannon.net", "spamcon.org",
  "spamevader.com", "spamfree24.org", "spamfrees.com",
  "spamherelots.com", "spamhereplease.com",
  "spaml.com", "spaml.de", "spammotel.com", "spamoff.de",
  "spamslicer.com", "spamspot.com", "spamthis.co.uk",
  "spamthisplease.com", "spamtroll.net",
  "stinkefinger.net", "stuffmail.de", "super-auswahl.de",
  "supermailer.jp", "suremail.info", "tafmail.com",
  "tagyourself.com", "teleworm.com", "teleworm.us",
  "thisisnotmyrealemail.com", "throwam.com",
  "tnprd.net", "trbvm.com", "trillianpro.com",
  "triq.net", "trmailbox.com", "tryalert.com",
  "turual.com", "twinmail.de", "tyldd.com",
  "uggsrock.com", "umail.net", "uroid.com",
  "veryrealemail.com", "vidchart.com", "viditag.com",
  "viralplays.com", "vkcode.ru", "vomoto.com",
  "vpn.st", "vsimcard.com", "w3internet.co.uk",
  "walala.org", "walkmail.net", "watchfull.net",
  "webemail.me", "webm4il.info", "wh4f.org",
  "whatiaas.com", "whatpaas.com", "whatsaas.com",
  "whopy.com", "wilemail.com", "willhackforfood.biz",
  "willselfdestruct.com", "wmail.cf", "writeme.us",
  "wwwnew.eu", "xagloo.com", "xemaps.com", "xents.com",
  "xmaily.com", "xoxy.net", "xzapmail.com",
  "yahoo.com.ph",  // not yahoo — common phishing clone pattern handled differently
  "yapped.net", "yeah.net", "yert.ye.vc",
  "yogamaven.com", "yopmail.com", "yopmail.fr",
  "yopmail.gq", "youmailr.com", "yourdomain.com",
  "ypmail.webarnak.fr.eu.org", "yuurok.com",
  "z1p.biz", "za.com", "zehnminuten.de",
  "zehnminutenmail.de", "zetmail.com", "zippymail.info",
  "zoaxe.com", "zoemail.net", "zoemail.org",
  "zomg.info", "zxcv.com", "zxcvbnm.com", "zzz.com",
]);

/**
 * Returns true if the email's domain is in the disposable blocklist.
 */
export function isDisposableEmail(email: string): boolean {
  const parts = email.toLowerCase().split("@");
  if (parts.length !== 2) return false;
  const domain = parts[1];
  return DISPOSABLE_EMAIL_DOMAINS.has(domain);
}
