using DashboardSample.Models;
using Microsoft.ServiceBus.Messaging;
using Microsoft.WindowsAzure.Storage;
using Microsoft.WindowsAzure.Storage.Blob;
using Newtonsoft.Json;
using System;
using System.IO;
using System.Collections.Generic;
using System.Configuration;
using System.Globalization;
using System.Linq;
using System.Text;
using System.Web.Mvc;


namespace DashboardSample.Controllers
{
    public class SettingsController : Controller
    {
        /* For Blob */
        private const string STORAGEACCOUNT_PROTOCOL = "https";// We use HTTPS to access the storage account
        private const string CONTAINER_NAME = "devicerules";// It's hard-coded for this workshop
        private const string BLOB_NAME = "devicerules.json";// It's hard-coded for this workshop
        private readonly string storageAccountConnectionString;

        /* For Service Bus */
        private const string QueueName = "temperatureAlert";// It's hard-coded for this workshop, try 'temperaturealert' if it does not work
        private readonly string serviceBusConnectionString;

        public SettingsController()
        {
            this.storageAccountConnectionString = ConfigurationManager.AppSettings["StorageAccount:ConnectionString"];
            this.serviceBusConnectionString = ConfigurationManager.AppSettings["ServiceBus:ConnectionString"];
        }

        /**
         * API : To enable or disable Device
         **/
        [HttpGet]
        public ActionResult EnableDevice(string deviceId, Boolean on)
        {
            System.Diagnostics.Debug.WriteLine("EnableDevice deviceId={0}, on={1}", deviceId, on);

            AlarmMessage alarmMessage = new AlarmMessage();
            alarmMessage.ioTHubDeviceID = deviceId;
            alarmMessage.alarmType = "EnableDevice";
            alarmMessage.reading = on ? "1" : "0";
            alarmMessage.threshold = "";
            alarmMessage.createdAt = DateTime.UtcNow.ToString("yyyy-MM-ddTHH:mm:ss.fffZ");

            var messageString = JsonConvert.SerializeObject(alarmMessage);
            SendAlarmMessageToServiceBusQueue(messageString);

            return this.Content("");
        }

        private void SendAlarmMessageToServiceBusQueue(string msg)
        {
            var client = QueueClient.CreateFromConnectionString(this.serviceBusConnectionString, QueueName);
            // var message = new BrokeredMessage(msg);
            var message = new BrokeredMessage(new MemoryStream(Encoding.UTF8.GetBytes(msg)), true);
            client.Send(message);
        }

        /**
         * API : To Upoload new temperature alarm rules
         **/
        [HttpGet]
        public ActionResult ApplyDeviceRules(int temperature)
        {
            System.Diagnostics.Debug.WriteLine("ApplyDeviceRules newAlarmRule=" + temperature);

            // Update the device rules of reference blob 
            UpdateReferenceBlob(temperature);

            return this.Content("");
        }

        private void UpdateReferenceBlob(int temperature)
        {
            System.Diagnostics.Debug.WriteLine("StorageConnectionString={0}", this.storageAccountConnectionString);
            System.Diagnostics.Debug.WriteLine("ContainerName={0}", CONTAINER_NAME);

            CloudStorageAccount storageAccount = CloudStorageAccount.Parse(this.storageAccountConnectionString);

            CloudBlobClient blobClient = storageAccount.CreateCloudBlobClient();

            // Retrieve a reference to a container.
            CloudBlobContainer container = blobClient.GetContainerReference(CONTAINER_NAME);

            // Create the container if it doesn't already exist.
            container.CreateIfNotExists();

            CreateAndUploadBlob(container, GetBlobFileName(), temperature);
        }

        private static void CreateAndUploadBlob(CloudBlobContainer container, string blobName, int temperature)
        {
            System.Diagnostics.Debug.WriteLine("container={0}, blobName={1}", container.Name, blobName);
            // Retrieve reference to a blob named "myblob".
            CloudBlockBlob blockBlob = container.GetBlockBlobReference(blobName);
            String blobContent = CreateDeviceRules(temperature);
            System.Diagnostics.Debug.WriteLine("blobContent={0}", blobContent);

            byte[] content = ASCIIEncoding.ASCII.GetBytes(blobContent);
            blockBlob.UploadFromByteArrayAsync(content, 0, content.Count()).Wait();
            System.Diagnostics.Debug.WriteLine("upload successful content.Count()={0}", content.Count());
        }

        private static String CreateDeviceRules(int temperature)
        {
            DeviceRule deviceRule = new DeviceRule();
            deviceRule.SensorType = "thermometer";
            deviceRule.TemperatureThreshold = temperature;
            List<DeviceRule> deviceRules = new List<DeviceRule>();
            deviceRules.Add(deviceRule);
            return JsonConvert.SerializeObject(deviceRules);
        }

        //When we save data to the blob storage for use as ref data on an ASA job, ASA picks that
        //data up based on the current time, and the data must be finished uploading before that time.
        //
        //From the Azure Team: "What this means is your blob in the path 
        //<...>/devicerules/2015-09-23/15-24/devicerules.json needs to be uploaded before the clock 
        //strikes 2015-09-23 15:25:00 UTC, preferably before 2015-09-23 15:24:00 UTC to be used when 
        //the clock strikes 2015-09-23 15:24:00 UTC"
        //
        //If we have many devices, an upload could take a measurable amount of time.
        //
        //Also, it is possible that the ASA clock is not precisely in sync with the
        //server clock. We want to store our update on a path slightly ahead of the current time so
        //that by the time ASA reads it we will no longer be making any updates to that blob -- i.e.
        //all current changes go into a future blob. We will choose two minutes into the future. In the
        //worst case, if we make a change at 12:03:59 and our write is delayed by ten seconds (until 
        //12:04:09) it will still be saved on the path {date}\12-05 and will be waiting for ASA to 
        //find in one minute.
        private const int blobSaveMinutesInTheFuture = 2;
        private const int blobSaveSecondsInTheFuture = 20;
        private static DateTimeFormatInfo _formatInfo;

        private static string GetBlobFileName()
        {
            // note: InvariantCulture is read-only, so use en-US and hardcode all relevant aspects
            CultureInfo culture = CultureInfo.CreateSpecificCulture("en-US");
            _formatInfo = culture.DateTimeFormat;
            _formatInfo.ShortDatePattern = @"yyyy-MM-dd";
            _formatInfo.ShortTimePattern = @"HH-mm";

            DateTime saveDate = DateTime.UtcNow.AddMinutes(blobSaveMinutesInTheFuture);
            //DateTime saveDate = DateTime.UtcNow.AddSeconds(blobSaveSecondsInTheFuture);
            string dateString = saveDate.ToString("d", _formatInfo);
            string timeString = saveDate.ToString("t", _formatInfo);
            string blobName = string.Format(@"{0}\{1}\{2}", dateString, timeString, BLOB_NAME);

            return blobName;
        }

        /**
         * API : To Get latest alarm rule from Azure blob storage
         **/        
        [HttpGet]
        public ActionResult GetAlarmRules(string fileName, string containerName, string storageConnectionString)
        {

            CloudStorageAccount storageAccount = CloudStorageAccount.Parse(this.storageAccountConnectionString);
            CloudBlobClient blobClient = storageAccount.CreateCloudBlobClient();
            CloudBlobContainer container = blobClient.GetContainerReference(CONTAINER_NAME);

            var blobList = container.ListBlobs(null, false);

            if (container.ListBlobs(null, false).Count() == 0)
            {
                Console.WriteLine("No any blob was found in {0}\n", containerName);
            }

            int latestYear = 0;
            int latestMonth = 0;
            int latestDay = 0;
            int latestHour = 0;
            int latestMin = 0;

            var latestItem = (dynamic)null;

            //find latest update blob file
            void settingLatestBlog(string[] date, string[] time, dynamic blob)
            {
                latestYear = int.Parse(date[0]);
                latestMonth = int.Parse(date[1]);
                latestDay = int.Parse(date[2]);
                latestHour = int.Parse(time[0]);
                latestMin = int.Parse(time[1]);
                latestItem = blob;
            }

            // Loop over items within the container and output the length and URI.
            foreach (IListBlobItem item in container.ListBlobs(null, true))
            {

                if (item.GetType() == typeof(CloudBlockBlob))
                {
                    CloudBlockBlob blob = (CloudBlockBlob)item;

                    string[] timeSplit = blob.Name.Split('/');
                    string[] date = timeSplit[0].Split('-'); //date[0]:Year, date[1]:Month, date[2]:Date
                    string[] time = timeSplit[1].Split('-'); //time[0]:hour, time[1]:Min
                    if(latestItem == null || 

                        int.Parse(date[0]) > latestYear || 
                        int.Parse(date[1]) > latestMonth || 
                        int.Parse(date[2]) > latestDay || 
                        int.Parse(time[0]) > latestHour || 
                        int.Parse(time[1]) > latestMin)
                    {
                        settingLatestBlog(date, time, blob);
                    }
                }
            }

            var downloadData = latestItem.DownloadText();
            return Content(JsonConvert.SerializeObject(downloadData), "application/json");
        }
    }
}