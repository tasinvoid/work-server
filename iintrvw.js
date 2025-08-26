const a = 10;
console.log(a);
//upload image to imageBB (DO NOT TOUCH)
app.post("/upload-to-imgbb", upload.single("image"), async (req, res) => {
  try {
    const apiKey = process.env.IMGBB_API_KEY;
    if (!apiKey) {
      return res
        .status(500)
        .json({ error: "ImageBB API key is not configured." });
    }

    const file = req.file;
    if (!file) {
      return res.status(400).json({ error: "No image file provided." });
    }
    const formData = new FormData();
    formData.append("image", file.buffer, { filename: file.originalname });
    const imgbbResponse = await axios.post(
      `https://api.imgbb.com/1/upload?key=${apiKey}`,
      formData,
      {
        headers: {
          ...formData.getHeaders(),
        },
      }
    );

    const imageUrl = imgbbResponse.data.data.url;
    res.status(200).json({ imageUrl });
  } catch (error) {
    res
      .status(500)
      .json({ error: "Failed to upload image. Please try again later." });
  }
});
