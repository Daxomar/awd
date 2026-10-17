// Existing venue furniture coordinates; also used by the server to validate attendance.
// Task tuples: title, situation, two choices, preferred choice. No clinical/financial advice.
const make=(x,z,label,tasks)=>({x,z,label,tasks:tasks.map(([title,situation,choices,best=0],i)=>({key:String(i),title,situation,choices,best,seconds:[40,55,70][i]??70}))});
export const WORKPLACES={
  trotro:make(-2.4,-3.1,'Dispatch vehicle',[
    ['Prepare the departure','The route board and vehicle list differ.',['Check the station route list','Call an unconfirmed destination']],
    ['Balance the trip sheet','One fare entry is missing.',['Reconcile the entry before signing','Estimate the missing entry']],
    ['Coordinate the queue','Two vehicles are ready for one departure.',['Follow the recorded dispatch queue','Send both vehicles together']]]),
  chef:make(.2,-2.9,'Kitchen preparation counter',[
    ['Prepare the order board','A table reports a food allergy.',['Flag the order with the kitchen lead','Send the standard order']],
    ['Organise ingredients','The prep station has unlabelled containers.',['Label and check stock first','Use whichever container is nearest']],
    ['Coordinate service','Two tables have waited different lengths of time.',['Check the order times','Serve the louder table first']]]),
  trader:make(1.9,1,'Market stock station',[
    ['Check a delivery','The delivery count differs from the invoice.',['Count stock with the supplier','Accept the invoice unchanged']],
    ['Prepare a customer order','One item is unavailable.',['Offer a clearly priced substitute','Hide the substitution']],
    ['Close the stock sheet','The shelf and notebook disagree.',['Recount the shelf','Change the notebook without checking']]]),
  tech:make(.9,-2.4,'Engineering desk',[
    ['Diagnose the service','A scheduled simulation job failed.',['Check logs and reproduce the failure','Restart everything without inspection']],
    ['Prepare a repair','A change affects shared records.',['Test on a disposable copy','Edit the live records first']],
    ['Review the handover','A teammate needs the incident history.',['Record cause, change and checks','Mark it done without notes']]]),
  bank:make(.6,-2.6,'Banking counter',[
    ['Handle the queue','A customer has a transaction dispute.',['Record the reference for review','Ask for their account PIN']],
    ['Reconcile the register','The register has an unmatched entry.',['Review the transaction record','Delete the unmatched entry']],
    ['Prepare the handover','A case is still unresolved.',['Leave a documented status','Tell the next shift it is finished']]]),
  nurse:make(-2.8,-2.8,'Ward administration desk',[
    ['Prepare the roster','A ward handover sheet is incomplete.',['Ask the shift lead to confirm it','Invent the missing entries']],
    ['Check supplies','The store list has expired stock.',['Separate and report it','Put it back with current stock']],
    ['Organise the queue','A visitor needs directions.',['Check the public reception list','Disclose private patient records']]]),
  doctor:make(-3.6,-3,'OPD administration desk',[
    ['Review appointment records','Two bookings share one slot.',['Ask reception to resolve the conflict','Erase one appointment']],
    ['Prepare the case conference','A simulated case file lacks a report.',['Request the missing record','Assume the result']],
    ['Complete a handover','A team task is still pending.',['Record the pending task clearly','Mark every task complete']]]),
  police:make(1.4,-2.2,'Charge office records',[
    ['Record an incident','A visitor has a reference number.',['Check the register privately','Announce their details to the room']],
    ['Check the equipment log','An item has no sign-out entry.',['Reconcile with the duty officer','Remove it from the list']],
    ['Prepare the duty handover','One public enquiry remains open.',['Record the next action','Close it without review']]]),
  radio:make(-.6,-.8,'Studio production desk',[
    ['Prepare a segment','A clip has no verified source.',['Check permission and attribution','Broadcast it as confirmed news']],
    ['Balance the rundown','The programme is running late.',['Coordinate the revised rundown','Cut a caller without warning']],
    ['Check the handover','A microphone channel is noisy.',['Log and test the channel','Raise every input to maximum']]]),
  dj:make(.6,-.4,'Event floor station',[
    ['Prepare the set','The next act needs a sound check.',['Coordinate with the stage lead','Start playback over their check']],
    ['Manage the transition','Two acts share a changeover.',['Follow the agreed running order','Change the order without asking']],
    ['Close the equipment log','A cable was damaged during service.',['Flag and isolate the cable','Hide it among working cables']]]),
  boxer:make(-4.4,-3,'Training station',[
    ['Prepare the session','A trainee has damaged gloves.',['Ask the coach for safe equipment','Continue with the damaged pair']],
    ['Organise the rounds','Two training plans conflict.',['Confirm the plan with the coach','Add extra rounds without checking']],
    ['Log the training','The coach asks for attendance.',['Record the actual attendance','Sign for absent trainees']]]),
  teacher:make(-2.6,-2.8,'Lecture preparation desk',[
    ['Prepare a seminar','Students requested extra examples.',['Add examples and discussion time','Repeat the same unexplained slide']],
    ['Review coursework','A submission needs private feedback.',['Use the confidential review channel','Publish its details to the class']],
    ['Prepare office hours','Two appointments overlap.',['Offer a clear revised schedule','Leave both groups waiting']]]),
  hotel:make(-5,-3,'Reception desk',[
    ['Prepare arrivals','A room is not yet cleared.',['Confirm readiness with housekeeping','Send the guest straight upstairs']],
    ['Coordinate an event','The room count changed.',['Update the event team','Keep the old headcount']],
    ['Complete the handover','A guest request is pending.',['Record it for the next shift','Mark it handled without checking']]]),
  aviation:make(1.2,-3.2,'Ground operations desk',[
    ['Prepare the passenger queue','A sign points to an old gate.',['Confirm and update the sign','Direct passengers from memory']],
    ['Review the ground checklist','One entry lacks confirmation.',['Ask the designated team to confirm','Tick it on their behalf']],
    ['Record the handover','A bag enquiry needs follow-up.',['Document the case reference','Discard the open enquiry']]]),
  civil:make(.6,-1.4,'Public service desk',[
    ['Process a public enquiry','A resident needs the correct form.',['Check the service directory','Send them to a guessed office']],
    ['Organise the register','Two records appear duplicated.',['Flag them for documented review','Delete one at random']],
    ['Prepare a meeting pack','A report is still a draft.',['Label its status accurately','Present it as approved']]]),
  ride:make(-4.6,.6,'Vehicle handover desk',[
    ['Prepare a vehicle','The check sheet reports a fault.',['Refer it for inspection','Mark it ready to drive']],
    ['Coordinate the booking','The pickup details are ambiguous.',['Confirm the designated pickup','Guess the passenger location']],
    ['Close the trip log','The mileage entry is missing.',['Check the recorded handover','Invent an entry']]]),
  fisher:make(2.6,-1.2,'Net preparation station',[
    ['Inspect the net','A section is damaged.',['Repair and check it first','Hide the tear in the bundle']],
    ['Prepare the catch log','Two basket counts disagree.',['Recount with the crew','Use the larger number']],
    ['Prepare the next crew','The equipment list is incomplete.',['Check and document the handover','Pass it on without checking']]]),
  fashion:make(1.7,.5,'Garment finishing table',[
    ['Prepare an alteration','The order has two measurements.',['Confirm the approved measurement','Cut using a guess']],
    ['Check the fabric','A panel has a visible defect.',['Flag it before cutting','Place it at the front unnoticed']],
    ['Finish the order','One fitting is still pending.',['Arrange the final fitting','Mark the order collected']]]),
  pastor:make(3.8,-3.6,'Community programme desk',[
    ['Prepare the community programme','Two groups booked the same room.',['Coordinate a revised schedule','Promise both groups the room']],
    ['Check the donation record','A receipt has no matching entry.',['Reconcile it transparently','Remove the receipt']],
    ['Prepare volunteer duties','A volunteer is unavailable.',['Confirm a replacement','Record them as present']]]),
};
