export default function handler(req, res) {
  res.status(200).json({ success: true, message: "Flixy v1 route is online" });
}
